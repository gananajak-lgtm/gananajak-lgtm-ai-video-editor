import assert from "node:assert/strict";
import test from "node:test";
import { validateInstagramHostingConfig } from "./instagram-hosting";
test("requires HTTPS Instagram staging endpoints",()=>{const config=validateInstagramHostingConfig({uploadUrl:"https://upload.example.com/put",publicBaseUrl:"https://cdn.example.com/videos/",bearerToken:"secret"});assert.equal(config.publicBaseUrl,"https://cdn.example.com/videos");assert.throws(()=>validateInstagramHostingConfig({uploadUrl:"http://upload.example.com",publicBaseUrl:"https://cdn.example.com"}),/HTTPS/);assert.throws(()=>validateInstagramHostingConfig({uploadUrl:"https://upload.example.com",publicBaseUrl:"http://cdn.example.com"}),/HTTPS/);});
