<?php
// Copy to includes/config.php or let setup.php generate it.

const CHATSPACE_DB_DRIVER = 'sqlite';
// setup.php generates a unique filename, for example:
const CHATSPACE_SQLITE_PATH = __DIR__ . '/../db/chatspace-00000000-0000-4000-8000-000000000000.sqlite';

// MySQL / MariaDB example:
// const CHATSPACE_DB_DRIVER = 'mysql';
// const CHATSPACE_DB_HOST = '127.0.0.1';
// const CHATSPACE_DB_PORT = 3306;
// const CHATSPACE_DB_NAME = 'chatspace_ce';
// const CHATSPACE_DB_USER = 'chatspace';
// const CHATSPACE_DB_PASS = '';
