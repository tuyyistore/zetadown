// Vercel Serverless Function: semua /api/* ditangani server yang sama dengan versi VPS.
import { buildServer } from '../src/zeta.js'

const server = buildServer()
export default (req, res) => server.emit('request', req, res)
