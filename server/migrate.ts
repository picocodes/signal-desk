import { migrate, pool } from "./db.js";
migrate().then(() => { console.log("Database schema is current."); return pool.end(); }).catch(error => { console.error(error); process.exit(1); });
