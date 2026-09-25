import test from "node:test";
import assert from "node:assert/strict";
import { affiliateJobToContentBrief } from "./affiliate-content-planner";

const job:any={id:"j1",status:"imported",attachProduct:true,product:{id:"p1",platform:"shopee",sourceUrl:"https://shopee.co.th/x",title:"Mini fan",price:299,currency:"THB",imageUrls:[],importedAt:"2026-09-25T00:00:00Z"}};

describe("affiliate content planner",()=>{
  it("uses verified product facts and short format",()=>{
    const brief=affiliateJobToContentBrief(job);
    expect(brief.format).toBe("short");
    expect(brief.topic).toContain("Mini fan");
    expect(brief.topic).toContain("299 THB");
    expect(brief.topic).toContain("Do not invent");
  });
});
