-- Configure Slave to replicate from Master using GTID
CHANGE MASTER TO
  MASTER_HOST='mysql-master',
  MASTER_PORT=3306,
  MASTER_USER='repl_user',
  MASTER_PASSWORD='replpassword',
  MASTER_AUTO_POSITION=1;

START SLAVE;
