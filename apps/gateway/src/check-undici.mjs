import { request } from 'undici';

async function test() {
  try {
    const res = await request('https://httpbin.org/get');
    console.log('res.body type:', res.body.constructor.name);
    console.log('has arrayBuffer:', typeof res.body.arrayBuffer);
    console.log('methods on proto:', Object.getOwnPropertyNames(Object.getPrototypeOf(res.body)));
  } catch (e) {
    console.error(e);
  }
}

test();
