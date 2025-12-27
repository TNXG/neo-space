#!/bin/bash
# MongoDB Replica Set 初始化脚本

sleep 5

mongosh --eval "
try {
  rs.status();
  print('Replica set already initialized');
} catch (e) {
  print('Initializing replica set...');
  rs.initiate({
    _id: 'rs0',
    members: [{ _id: 0, host: 'mongodb:27017' }]
  });
  print('Replica set initialized');
}
"
