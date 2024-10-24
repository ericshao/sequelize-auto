./bin/sequelize-auto -h pc-uf6e83x2j0m347qu1.mysql.polardb.rds.aliyuncs.com -u c2cloud  -x App#3220 -o ./output --op 7 --em entity -d c2cloud -t bwp_lg_pre_increase_bsc


## 生成表头
./bin/midway-auto -o ./output -n billDirBsc  -a 径予自主申报表头 --ak    -t bsc --mn bwp --an lingang

## 生成表体
./bin/midway-auto -o ./output -n billDirDt  -a 径予自主申报表体 --ak bdbUid   -t item --mn bwp --an lingang

## 生成聚合根
./bin/midway-auto -o ./output -n billDir  -a 径予自主申报 --ak   bdbUid  -t aggr --mn bwp --an lingang