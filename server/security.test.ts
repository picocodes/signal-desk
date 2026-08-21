import { beforeAll,describe,expect,it } from "vitest";
let security:typeof import("./security.js");
beforeAll(async()=>{process.env.APP_ENCRYPTION_KEY="test-encryption-key-that-is-long-enough";security=await import("./security.js")});
describe("security primitives",()=>{
 it("hashes tokens without retaining the token",()=>{const token=security.randomToken();expect(security.hashToken(token)).not.toContain(token);expect(security.hashToken(token)).toHaveLength(64)});
 it("encrypts settings with authenticated encryption",()=>{const encrypted=security.encrypt("secret-value");expect(encrypted).not.toContain("secret-value");expect(security.decrypt(encrypted)).toBe("secret-value");expect(()=>security.decrypt(encrypted.slice(0,-1)+"x")).toThrow()});
});
