import assert from "node:assert/strict";
import test from "node:test";
import { BrokerRateLimiter,safeBrokerError } from "./meta-auth-broker-http";
test("broker rate limiter caps a client inside the window",()=>{const limiter=new BrokerRateLimiter(2,1000);assert.equal(limiter.allow("ip",0),true);assert.equal(limiter.allow("ip",1),true);assert.equal(limiter.allow("ip",2),false);assert.equal(limiter.allow("ip",1000),true);});
test("broker errors redact likely credentials",()=>{assert.equal(safeBrokerError(new Error("access token failed")),"Broker request failed.");assert.equal(safeBrokerError(new Error("client_secret leaked")),"Broker request failed.");assert.equal(safeBrokerError(new Error("Invalid broker session.")),"Invalid broker session.");});
