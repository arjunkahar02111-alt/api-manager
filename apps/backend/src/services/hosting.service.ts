import fs from 'node:fs';
import path from 'node:path';
import { spawn, ChildProcess } from 'node:child_process';
import AdmZip from 'adm-zip';
import { HostingDeployment, ApiCatalog } from '../database/models/index.js';
import { getRedisClient } from './redis.service.js';
import { RealtimeService } from './realtime.service.js';
import { NotFoundError, ConflictError } from '@arjun/shared';

const DEPLOYMENTS_ROOT = path.join(process.cwd(), 'deployments');

// Keep in-memory references to active child processes
const activeProcesses = new Map<string, ChildProcess>();

export class HostingService {
  /**
   * Initializes the deployments workspace directory
   */
  static initWorkspace() {
    if (!fs.existsSync(DEPLOYMENTS_ROOT)) {
      fs.mkdirSync(DEPLOYMENTS_ROOT, { recursive: true });
    }
  }

  /**
   * Deploys a new micro-application from an uploaded ZIP archive or source files
   */
  static async createDeployment(params: {
    name: string;
    slug: string;
    description?: string;
    runtime: 'nodejs' | 'python' | 'php' | 'custom';
    port: number;
    gatewayPath: string;
    envVars?: Record<string, string>;
    entryPoint?: string;
    zipBuffer?: Buffer;
  }) {
    this.initWorkspace();

    const existing = await HostingDeployment.findOne({
      $or: [{ slug: params.slug }, { port: params.port }, { gatewayPath: params.gatewayPath }],
    });
    if (existing) {
      throw new ConflictError('A deployment with this slug, port, or gateway path already exists');
    }

    const deployDir = path.join(DEPLOYMENTS_ROOT, params.slug);
    if (!fs.existsSync(deployDir)) {
      fs.mkdirSync(deployDir, { recursive: true });
    }

    // Extract ZIP archive if provided, safely preventing ZipSlip / path traversal
    if (params.zipBuffer) {
      const zip = new AdmZip(params.zipBuffer);
      const zipEntries = zip.getEntries();
      for (const entry of zipEntries) {
        const entryPath = entry.entryName;
        // Check for path traversal attacks
        if (entryPath.includes('..') || path.isAbsolute(entryPath)) {
          throw new Error(`Security Violation: Unsafe file path detected in ZIP: ${entryPath}`);
        }
      }
      zip.extractAllTo(deployDir, true);
    } else {
      // Default placeholder starter template if no files uploaded
      if (params.runtime === 'nodejs') {
        fs.writeFileSync(
          path.join(deployDir, 'index.js'),
          `import http from 'http';
const port = ${params.port};
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ status: 'ok', service: '${params.name}', time: new Date() }));
});
server.listen(port, () => console.log('Listening on ' + port));`
        );
      } else if (params.runtime === 'python') {
        fs.writeFileSync(
          path.join(deployDir, 'app.py'),
          `from http.server import HTTPServer, BaseHTTPRequestHandler
import json
class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        self.send_response(200)
        self.send_header('Content-type', 'application/json')
        self.end_headers()
        self.wfile.write(json.dumps({'status': 'ok', 'service': '${params.name}'}).encode())
HTTPServer(('127.0.0.1', ${params.port}), Handler).serve_forever()`
        );
      }
    }

    const deployment = await HostingDeployment.create({
      name: params.name,
      slug: params.slug,
      description: params.description || '',
      runtime: params.runtime,
      port: params.port,
      gatewayPath: params.gatewayPath.startsWith('/') ? params.gatewayPath : `/${params.gatewayPath}`,
      envVars: params.envVars || {},
      workingDir: deployDir,
      entryPoint: params.entryPoint || (params.runtime === 'python' ? 'app.py' : 'index.js'),
      status: 'stopped',
    });

    // Auto-mount into API Gateway Catalog so it is instantly proxyable!
    await ApiCatalog.findOneAndUpdate(
      { slug: `hosted-${params.slug}` },
      {
        name: `[Hosted] ${params.name}`,
        slug: `hosted-${params.slug}`,
        description: `Auto-hosted ${params.runtime} service`,
        category: 'Hosted Services',
        version: 'v1',
        gatewayPath: deployment.gatewayPath,
        upstreamBaseUrl: `http://127.0.0.1:${params.port}`,
        upstreamPath: '',
        allowedMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD'],
        status: 'active',
        timeoutMs: 30000,
        authenticationRequired: true,
        allowedPlans: ['*'],
      },
      { upsert: true }
    );

    const redis = getRedisClient();
    await redis.del('gateway:catalog');
    await redis.del(`gateway:api:${deployment.gatewayPath}`);

    return deployment;
  }

  /**
   * Starts a deployment supervisor process
   */
  static async startDeployment(id: string) {
    const deployment = await HostingDeployment.findById(id);
    if (!deployment) throw new NotFoundError('Deployment not found');

    // If already running, return
    if (activeProcesses.has(id)) {
      return deployment;
    }

    const outLogPath = path.join(deployment.workingDir, 'stdout.log');
    const errLogPath = path.join(deployment.workingDir, 'stderr.log');
    const outStream = fs.createWriteStream(outLogPath, { flags: 'a' });
    const errStream = fs.createWriteStream(errLogPath, { flags: 'a' });

    let command = 'node';
    let args = [deployment.entryPoint];

    if (deployment.runtime === 'python') {
      command = 'python';
      args = [deployment.entryPoint];
    } else if (deployment.runtime === 'php') {
      command = 'php';
      args = ['-S', `127.0.0.1:${deployment.port}`, deployment.entryPoint];
    }

    const env = {
      ...process.env,
      ...deployment.envVars,
      PORT: deployment.port.toString(),
    };

    const child = spawn(command, args, {
      cwd: deployment.workingDir,
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: true,
    });

    child.stdout?.pipe(outStream);
    child.stderr?.pipe(errStream);

    activeProcesses.set(id, child);

    deployment.status = 'running';
    deployment.pid = child.pid;
    deployment.healthStatus = 'healthy';
    await deployment.save();

    child.on('exit', async (code) => {
      activeProcesses.delete(id);
      const dep = await HostingDeployment.findById(id);
      if (dep) {
        dep.status = code === 0 ? 'stopped' : 'failed';
        dep.healthStatus = 'unhealthy';
        dep.pid = undefined;
        await dep.save();
      }
    });

    RealtimeService.broadcast('deployment_status', {
      id: deployment._id.toString(),
      name: deployment.name,
      status: 'running',
      port: deployment.port,
    });

    return deployment;
  }

  /**
   * Stops an active deployment process
   */
  static async stopDeployment(id: string) {
    const deployment = await HostingDeployment.findById(id);
    if (!deployment) throw new NotFoundError('Deployment not found');

    const proc = activeProcesses.get(id);
    if (proc) {
      try {
        proc.kill('SIGTERM');
      } catch {}
      activeProcesses.delete(id);
    }

    deployment.status = 'stopped';
    deployment.healthStatus = 'unknown';
    deployment.pid = undefined;
    await deployment.save();

    RealtimeService.broadcast('deployment_status', {
      id: deployment._id.toString(),
      name: deployment.name,
      status: 'stopped',
    });

    return deployment;
  }

  /**
   * Restarts a deployment
   */
  static async restartDeployment(id: string) {
    await this.stopDeployment(id);
    await new Promise((r) => setTimeout(r, 1000));
    return this.startDeployment(id);
  }

  /**
   * Deletes a deployment, stops its process, and removes files
   */
  static async deleteDeployment(id: string) {
    const deployment = await HostingDeployment.findById(id);
    if (!deployment) throw new NotFoundError('Deployment not found');

    await this.stopDeployment(id);

    // Remove from ApiCatalog
    await ApiCatalog.deleteOne({ slug: `hosted-${deployment.slug}` });
    const redis = getRedisClient();
    await redis.del('gateway:catalog');
    await redis.del(`gateway:api:${deployment.gatewayPath}`);

    // Remove directory safely
    try {
      if (fs.existsSync(deployment.workingDir)) {
        fs.rmSync(deployment.workingDir, { recursive: true, force: true });
      }
    } catch {}

    await HostingDeployment.findByIdAndDelete(id);
  }

  /**
   * Reads logs from the deployment working directory
   */
  static async getLogs(id: string): Promise<{ stdout: string; stderr: string }> {
    const deployment = await HostingDeployment.findById(id);
    if (!deployment) throw new NotFoundError('Deployment not found');

    const outLogPath = path.join(deployment.workingDir, 'stdout.log');
    const errLogPath = path.join(deployment.workingDir, 'stderr.log');

    const stdout = fs.existsSync(outLogPath) ? fs.readFileSync(outLogPath, 'utf-8').slice(-10000) : '';
    const stderr = fs.existsSync(errLogPath) ? fs.readFileSync(errLogPath, 'utf-8').slice(-10000) : '';

    return { stdout, stderr };
  }

  /**
   * List all deployments
   */
  static async listDeployments() {
    return HostingDeployment.find().sort({ createdAt: -1 });
  }
}
