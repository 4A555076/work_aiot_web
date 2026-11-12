const swaggerJsdoc = require("swagger-jsdoc");
const path = require("path");

const port = process.env.port || 4000;

const options = {
  definition: {
    openapi: "3.0.0",

    info: {
      title: "AIOT資訊整合 API",
      version: "1.0.0",
      description: "提供外部設備與前端網頁儀表板介接之 API",
    },
    
    servers: [
      {
        url:  `http://localhost:${port}`,
        description: "Local Server",
      },
    ],

    tags: [
      {
        name: 'Fire',
        description: '火災專案相關 API',
      },
      {
        name: 'User',
        description: '使用者相關 API',
      },
    ],

    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
    },
  },

 apis: [path.join(__dirname, "../routes/**/*.js")],
};

const swaggerSpec = swaggerJsdoc(options);

module.exports = swaggerSpec;