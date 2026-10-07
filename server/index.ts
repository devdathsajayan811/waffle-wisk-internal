import { app } from './app.js';
import { config } from './config.js';
import { getDatabase } from './db/index.js';

getDatabase()
  .then(() => {
    app.listen(config.port, () => {
      console.log(`Waffle Wisk API running on http://localhost:${config.port}`);
    });
  })
  .catch((err) => {
    console.error('Failed to initialize database:', err);
    process.exit(1);
  });
