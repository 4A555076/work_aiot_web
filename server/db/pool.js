const sql = require("mssql");
const dbConfig = require("../databaseConfig");

const pools = {}; 

async function getConnection(name = "AIOT") {
  if (!dbConfig[name]) {
    throw new Error(`Unknown database config: ${name}`);
  }

  // 若該 Pool 尚未存在，建立它
  if (!pools[name]) {
    const pool = new sql.ConnectionPool(dbConfig[name]);
    const poolConnect = pool.connect()
      .then(() => {
        console.log(`[DB Connected] ${name}`);
      })
      .catch(err => {
        console.error(`[DB Connection Failed] ${name}`, err);
        delete pools[name];
        throw err;
      });

    pool.on("error", err => {
      console.error(`[DB Pool Error] ${name}`, err);
      delete pools[name];
    });

    pools[name] = { pool, poolConnect };
  }

  // 等待連線完成後再回傳 Pool
  await pools[name].poolConnect;
  return pools[name].pool;
}

module.exports = { getConnection };
