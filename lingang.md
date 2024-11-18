## 生成表头
./bin/sequelize-auto -h pc-uf6e83x2j0m347qu1.mysql.polardb.rds.aliyuncs.com -u c2cloud  -x App#3220 -o ./output --op 5 --em entity -d c2cloud -t bwp_lg_bill_dir_bsc --prefix bdb
./bin/midway-auto -o ./output -n billDirBsc  -a 径予放行表头 --ak    -t bsc --mn bwp --an lingang

## 生成表体
./bin/sequelize-auto -h pc-uf6e83x2j0m347qu1.mysql.polardb.rds.aliyuncs.com -u c2cloud  -x App#3220 -o ./output --op 5 --em item -d c2cloud -t bwp_lg_bill_dir_dt --prefix bdb
./bin/midway-auto -o ./output -n billDirWh  -a 径予放行出入库 --ak bdbUid   -t item --mn bwp --an lingang

## 生成聚合根
./bin/midway-auto -o ./output -n billDir  -a 径予放行 --ak   bdbUid  -t aggr --mn bwp --an lingang