"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_cron_1 = __importDefault(require("node-cron"));
const db_1 = __importDefault(require("../config/db"));
const keepAlive = node_cron_1.default.schedule('*/4 * * * *', async () => {
    try {
        const client = await db_1.default.connect();
        await client.query('SELECT 1');
        client.release();
    }
    catch (error) {
        console.error('Error occurred while pinging the database:', error);
    }
});
exports.default = keepAlive;
