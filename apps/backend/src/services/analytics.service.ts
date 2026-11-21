import { Customer, RequestLog, UsageDaily, UsageMonthly, ApiCatalog } from '../database/models/index.js';

export class AnalyticsService {
  /**
   * Super Admin Overview Real Statistics
   */
  static async getAdminOverview() {
    const today = new Date().toISOString().substring(0, 10);
    const month = today.substring(0, 7);

    // Customer counts
    const [totalCustomers, activeCustomers, suspendedCustomers, expiredCustomers] = await Promise.all([
      Customer.countDocuments({ status: { $ne: 'deleted' } }),
      Customer.countDocuments({ status: 'active', expiresAt: { $gt: new Date() } }),
      Customer.countDocuments({ status: 'suspended' }),
      Customer.countDocuments({ $or: [{ status: 'expired' }, { expiresAt: { $lte: new Date() }, status: 'active' }] }),
    ]);

    // Usage counts from MongoDB aggregated tables
    const todayStats = await UsageDaily.aggregate([
      { $match: { date: today } },
      {
        $group: {
          _id: null,
          totalRequests: { $sum: '$requests' },
          successfulRequests: { $sum: '$successfulRequests' },
          failedRequests: { $sum: '$failedRequests' },
          bandwidthBytes: { $sum: '$bandwidthBytes' },
        },
      },
    ]);

    const monthStats = await UsageMonthly.aggregate([
      { $match: { month } },
      {
        $group: {
          _id: null,
          totalRequests: { $sum: '$requests' },
          bandwidthBytes: { $sum: '$bandwidthBytes' },
        },
      },
    ]);

    // Total lifetime requests across system
    const lifetimeStats = await UsageMonthly.aggregate([
      {
        $group: {
          _id: null,
          totalRequests: { $sum: '$requests' },
          successfulRequests: { $sum: '$successfulRequests' },
          failedRequests: { $sum: '$failedRequests' },
          bandwidthBytes: { $sum: '$bandwidthBytes' },
        },
      },
    ]);

    // Top APIs by usage this month
    const topApis = await UsageMonthly.aggregate([
      { $match: { month } },
      {
        $group: {
          _id: '$apiId',
          requests: { $sum: '$requests' },
          bandwidthBytes: { $sum: '$bandwidthBytes' },
        },
      },
      { $sort: { requests: -1 } },
      { $limit: 5 },
      {
        $lookup: {
          from: 'api_catalog',
          localField: '_id',
          foreignField: '_id',
          as: 'api',
        },
      },
      { $unwind: { path: '$api', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          apiId: '$_id',
          name: '$api.name',
          gatewayPath: '$api.gatewayPath',
          requests: 1,
          bandwidthBytes: 1,
        },
      },
    ]);

    // Top customers by usage this month
    const topCustomers = await UsageMonthly.aggregate([
      { $match: { month } },
      {
        $group: {
          _id: '$customerId',
          requests: { $sum: '$requests' },
          bandwidthBytes: { $sum: '$bandwidthBytes' },
        },
      },
      { $sort: { requests: -1 } },
      { $limit: 5 },
      {
        $lookup: {
          from: 'customers',
          localField: '_id',
          foreignField: '_id',
          as: 'customer',
        },
      },
      { $unwind: { path: '$customer', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          customerId: '$_id',
          username: '$customer.username',
          fullName: '$customer.fullName',
          requests: 1,
          bandwidthBytes: 1,
        },
      },
    ]);

    return {
      customers: {
        total: totalCustomers,
        active: activeCustomers,
        suspended: suspendedCustomers,
        expired: expiredCustomers,
      },
      requests: {
        today: todayStats[0]?.totalRequests || 0,
        todaySuccess: todayStats[0]?.successfulRequests || 0,
        todayFailed: todayStats[0]?.failedRequests || 0,
        thisMonth: monthStats[0]?.totalRequests || 0,
        lifetime: lifetimeStats[0]?.totalRequests || 0,
        lifetimeBandwidthBytes: lifetimeStats[0]?.bandwidthBytes || 0,
      },
      topApis,
      topCustomers,
    };
  }

  /**
   * Request trends over last N days
   */
  static async getDailyTrends(days = 14) {
    const dates: string[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      dates.push(d.toISOString().substring(0, 10));
    }

    const records = await UsageDaily.aggregate([
      { $match: { date: { $in: dates } } },
      {
        $group: {
          _id: '$date',
          requests: { $sum: '$requests' },
          successful: { $sum: '$successfulRequests' },
          failed: { $sum: '$failedRequests' },
          bandwidth: { $sum: '$bandwidthBytes' },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    const recordMap = new Map(records.map((r) => [r._id, r]));
    return dates.map((date) => {
      const r = recordMap.get(date);
      return {
        date,
        requests: r?.requests || 0,
        successful: r?.successful || 0,
        failed: r?.failed || 0,
        bandwidthBytes: r?.bandwidth || 0,
      };
    });
  }

  /**
   * Real percentile latencies (P50, P95, P99) and RPS calculated from real RequestLog telemetry
   */
  static async getPerformanceMetrics(hours = 24) {
    const since = new Date(Date.now() - hours * 3600 * 1000);

    const logs = await RequestLog.find({ timestamp: { $gte: since } }, { durationMs: 1, statusCode: 1 })
      .sort({ durationMs: 1 })
      .lean();

    const total = logs.length;
    if (total === 0) {
      return {
        totalRequests: 0,
        rps: 0,
        avgLatencyMs: 0,
        p50LatencyMs: 0,
        p95LatencyMs: 0,
        p99LatencyMs: 0,
        successRate: 100,
        statusDistribution: { '2xx': 0, '4xx': 0, '5xx': 0 },
      };
    }

    const durations = logs.map((l) => l.durationMs || 0).sort((a, b) => a - b);
    const sum = durations.reduce((a, b) => a + b, 0);
    const avg = Math.round(sum / total);

    const p50 = durations[Math.floor(total * 0.5)] || 0;
    const p95 = durations[Math.floor(total * 0.95)] || 0;
    const p99 = durations[Math.floor(total * 0.99)] || 0;

    let count2xx = 0;
    let count4xx = 0;
    let count5xx = 0;

    for (const l of logs) {
      const code = l.statusCode || 200;
      if (code >= 200 && code < 300) count2xx++;
      else if (code >= 400 && code < 500) count4xx++;
      else if (code >= 500) count5xx++;
    }

    const rps = parseFloat((total / (hours * 3600)).toFixed(2));
    const successRate = parseFloat(((count2xx / total) * 100).toFixed(1));

    return {
      totalRequests: total,
      rps,
      avgLatencyMs: avg,
      p50LatencyMs: p50,
      p95LatencyMs: p95,
      p99LatencyMs: p99,
      successRate,
      statusDistribution: {
        '2xx': count2xx,
        '4xx': count4xx,
        '5xx': count5xx,
      },
    };
  }

  /**
   * Export daily analytics summary to CSV
   */
  static async exportDailyCsv(days = 30): Promise<string> {
    const trends = await this.getDailyTrends(days);
    const header = 'Date,TotalRequests,SuccessfulRequests,FailedRequests,BandwidthBytes\n';
    const rows = trends
      .map((t) => `${t.date},${t.requests},${t.successful},${t.failed},${t.bandwidthBytes}`)
      .join('\n');
    return header + rows;
  }
}
