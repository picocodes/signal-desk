import crypto from "node:crypto";
import type { Request, Response, NextFunction } from "express";
import { pool } from "./db.js";

export type Actor={id:string;email:string;name:string;platformRole:"super_admin"|"moderator"|"customer";mustChangePassword:boolean};
const digest=(value:string)=>crypto.createHash("sha256").update(value).digest("hex");
export const randomToken=()=>crypto.randomBytes(32).toString("base64url");
export const hashToken=digest;

export async function createSession(res:Response,userId:string,req:Request){const raw=randomToken();await pool.query("insert into sessions(id,user_id,token_hash,expires_at,user_agent,ip) values($1,$2,$3,now()+interval '30 days',$4,$5)",[crypto.randomUUID(),userId,digest(raw),req.get("user-agent")?.slice(0,500),req.ip]);res.cookie("sd_session",raw,{httpOnly:true,secure:process.env.NODE_ENV==="production",sameSite:"lax",maxAge:30*86400_000,path:"/"});}
export async function optionalAuth(req:Request,res:Response,next:NextFunction){try{const raw=req.cookies?.sd_session;if(!raw){res.locals.actor=null;return next();}const q=await pool.query(`select u.id,u.email,u.name,u.platform_role,u.must_change_password from sessions s join users u on u.id=s.user_id where s.token_hash=$1 and s.revoked_at is null and s.expires_at>now() and u.suspended_at is null`,[digest(raw)]);res.locals.actor=q.rowCount?{id:q.rows[0].id,email:q.rows[0].email,name:q.rows[0].name,platformRole:q.rows[0].platform_role,mustChangePassword:q.rows[0].must_change_password}:null;return next();}catch(e){next(e)}}
export function requireAuth(_req:Request,res:Response,next:NextFunction){if(!res.locals.actor)return res.status(401).json({message:"Sign in to continue."});next();}
export function requirePlatform(...roles:Actor["platformRole"][]){return(_req:Request,res:Response,next:NextFunction)=>roles.includes(res.locals.actor?.platformRole)?next():res.status(403).json({message:"You do not have access to this area."});}
const rank={viewer:0,editor:1,admin:2,owner:3};
export async function requireOrg(req:Request,res:Response,next:NextFunction){try{const id=req.params.organizationId||req.body.organizationId||req.query.organizationId;if(!id)return res.status(400).json({message:"Organization is required."});if(res.locals.actor.platformRole==="super_admin") {res.locals.organizationRole="owner";return next();}const q=await pool.query("select role from memberships where organization_id=$1 and user_id=$2",[id,res.locals.actor.id]);if(!q.rowCount)return res.status(403).json({message:"You do not have access to this organization."});res.locals.organizationRole=q.rows[0].role;next();}catch(e){next(e)}}
export const requireOrgRole=(minimum:keyof typeof rank)=>(_req:Request,res:Response,next:NextFunction)=>rank[res.locals.organizationRole as keyof typeof rank]>=rank[minimum]?next():res.status(403).json({message:"Your organization role cannot perform this action."});

function key(){const raw=process.env.APP_ENCRYPTION_KEY||"";if(raw.length<32)throw new Error("APP_ENCRYPTION_KEY must contain at least 32 characters");return crypto.createHash("sha256").update(raw).digest();}
export function encrypt(value:string){const iv=crypto.randomBytes(12),cipher=crypto.createCipheriv("aes-256-gcm",key(),iv);const data=Buffer.concat([cipher.update(value,"utf8"),cipher.final()]);return ["v1",iv.toString("base64url"),cipher.getAuthTag().toString("base64url"),data.toString("base64url")].join(".");}
export function decrypt(value:string){const[,iv,tag,data]=value.split(".");const decipher=crypto.createDecipheriv("aes-256-gcm",key(),Buffer.from(iv,"base64url"));decipher.setAuthTag(Buffer.from(tag,"base64url"));return Buffer.concat([decipher.update(Buffer.from(data,"base64url")),decipher.final()]).toString("utf8");}
export async function audit(actorId:string|undefined,organizationId:string|undefined,action:string,entityType?:string,entityId?:string,metadata:Record<string,unknown>={}){await pool.query("insert into audit_events(id,actor_id,organization_id,action,entity_type,entity_id,metadata) values($1,$2,$3,$4,$5,$6,$7)",[crypto.randomUUID(),actorId||null,organizationId||null,action,entityType||null,entityId||null,metadata]);}
