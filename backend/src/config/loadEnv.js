import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const backendEnvPath = path.resolve(__dirname, '../../.env');

/**
 * On Render, environment variables come from the dashboard — do not load any .env file.
 * A repo or build artifact .env with empty CLOUDINARY_* lines would otherwise sit in process.env
 * and block host-provided values (dotenv does not override by default, but an empty file can
 * still populate keys that Render never set due to typos).
 */
const runningOnRender =
  process.env.RENDER === 'true' ||
  process.env.RENDER === '1' ||
  Boolean(process.env.RENDER_SERVICE_ID);

if (!runningOnRender) {
  dotenv.config({ path: backendEnvPath });
  dotenv.config({ path: path.resolve(process.cwd(), '.env') });
}
