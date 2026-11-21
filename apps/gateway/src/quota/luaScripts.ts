/**
 * Atomic Redis Lua Script for Quota & Rate Limit Enforcement
 * Executes all limit checks atomically to eliminate race conditions under concurrent load.
 * Returns a standard Redis table (array) for universal compatibility with real Redis & in-memory stores.
 */

export const ATOMIC_QUOTA_CHECK_AND_RESERVE_LUA = `
local dailyKey = KEYS[1]
local monthlyKey = KEYS[2]
local lifetimeKey = KEYS[3]
local endpointKey = KEYS[4]
local concurrencyKey = KEYS[5]
local rateLimitKey = KEYS[6]
local bandwidthKey = KEYS[7]

local dailyLimit = tonumber(ARGV[1])
local monthlyLimit = tonumber(ARGV[2])
local lifetimeLimit = tonumber(ARGV[3])
local endpointLimit = tonumber(ARGV[4])
local concurrencyLimit = tonumber(ARGV[5])
local rateLimitPerSec = tonumber(ARGV[6])
local bandwidthLimit = tonumber(ARGV[7])

local dailyTtl = tonumber(ARGV[8])
local monthlyTtl = tonumber(ARGV[9])

-- 1. Check Rate Limit (Requests per second)
local currentRate = tonumber(redis.call('get', rateLimitKey) or '0')
if currentRate >= rateLimitPerSec then
    return { 0, 'RATE_LIMIT_EXCEEDED', 'Per-second rate limit exceeded. Please throttle your requests.' }
end

-- 2. Check Concurrency Limit
local currentConcurrency = tonumber(redis.call('get', concurrencyKey) or '0')
if currentConcurrency >= concurrencyLimit then
    return { 0, 'CONCURRENCY_LIMIT_REACHED', 'Maximum simultaneous concurrent requests reached for your account.' }
end

-- 3. Check Daily Quota
local currentDaily = tonumber(redis.call('get', dailyKey) or '0')
if dailyLimit > 0 and currentDaily >= dailyLimit then
    return { 0, 'DAILY_QUOTA_EXCEEDED', 'Your daily API request quota has been exceeded.' }
end

-- 4. Check Monthly Quota
local currentMonthly = tonumber(redis.call('get', monthlyKey) or '0')
if monthlyLimit > 0 and currentMonthly >= monthlyLimit then
    return { 0, 'MONTHLY_QUOTA_EXCEEDED', 'Your monthly API request quota has been exceeded.' }
end

-- 5. Check Lifetime Quota
local currentLifetime = tonumber(redis.call('get', lifetimeKey) or '0')
if lifetimeLimit > 0 and currentLifetime >= lifetimeLimit then
    return { 0, 'LIFETIME_QUOTA_EXCEEDED', 'Your lifetime API request quota has been reached.' }
end

-- 6. Check Endpoint Quota
if endpointLimit > 0 then
    local currentEndpoint = tonumber(redis.call('get', endpointKey) or '0')
    if currentEndpoint >= endpointLimit then
        return { 0, 'ENDPOINT_QUOTA_EXCEEDED', 'Per-endpoint request quota exceeded for this API.' }
    end
end

-- 7. Check Bandwidth Quota
if bandwidthLimit > 0 then
    local currentBandwidth = tonumber(redis.call('get', bandwidthKey) or '0')
    if currentBandwidth >= bandwidthLimit then
        return { 0, 'BANDWIDTH_LIMIT_EXCEEDED', 'Your account bandwidth limit has been exceeded.' }
    end
end

-- ALL CHECKS PASSED: Atomically increment counters & reserve slot
redis.call('incr', rateLimitKey)
redis.call('expire', rateLimitKey, 2)

redis.call('incr', concurrencyKey)
redis.call('expire', concurrencyKey, 60) -- 60s fallback safety expiry

local newDaily = redis.call('incr', dailyKey)
if newDaily == 1 and dailyTtl > 0 then
    redis.call('expire', dailyKey, dailyTtl)
end

local newMonthly = redis.call('incr', monthlyKey)
if newMonthly == 1 and monthlyTtl > 0 then
    redis.call('expire', monthlyKey, monthlyTtl)
end

local newLifetime = redis.call('incr', lifetimeKey)

if endpointLimit > 0 then
    local newEndpoint = redis.call('incr', endpointKey)
    if newEndpoint == 1 and dailyTtl > 0 then
        redis.call('expire', endpointKey, dailyTtl)
    end
end

local remainingDaily = dailyLimit > 0 and math.max(0, dailyLimit - newDaily) or 999999

return {
    1,
    newDaily,
    dailyLimit,
    remainingDaily,
    newMonthly,
    monthlyLimit,
    newLifetime
}
`;

export const RELEASE_CONCURRENCY_LUA = `
local concurrencyKey = KEYS[1]
local current = tonumber(redis.call('get', concurrencyKey) or '0')
if current > 0 then
    redis.call('decr', concurrencyKey)
end
return 1
`;
