const databaseConfig = {
  AIOT: {
    user: process.env.AIOTUSER,
    password: process.env.AIOTPASSWORD,
    server: process.env.AIOTSERVER,
    database: process.env.AIOTDATABASE,
    options: {
      encrypt: false,
      trustServerCertificate: true,
    },
    requestTimeout: 60000,
    connectionTimeout: 15000,
    pool: {
      max: 15,
      min: 5,
      idleTimeoutMillis: 60000
    },
  },
  WebAIOT: {
    user: process.env.WEBAIOTUSER,
    password: process.env.WEBAIOTPASSWORD,
    server: process.env.WEBAIOTSERVER,
    database: process.env.WEBAIOTDATABASE,
    options: {
      encrypt: false,
      trustServerCertificate: true,
    },
    requestTimeout: 60000,
    connectionTimeout: 15000,
    pool: {
      max: 15,
      min: 5,
      idleTimeoutMillis: 60000
    }
  },
  IOT: {
    user: process.env.IOTUSER,
    password: process.env.IOTPASSWORD,
    server: process.env.IOTSERVER,
    database: process.env.IOTDATABASE,
    options: {
      encrypt: false,
      trustServerCertificate: true,
    },
    requestTimeout: 60000,
    connectionTimeout: 15000,
    pool: {
      max: 15,
      min: 5,
      idleTimeoutMillis: 60000
    },
  },
};

module.exports = databaseConfig;
