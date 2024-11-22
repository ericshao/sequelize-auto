## 生成表头
./bin/sequelize-auto -h pc-uf6e83x2j0m347qu1.mysql.polardb.rds.aliyuncs.com -u c2cloud  -x App#3220 -o ./output --op 5 --em entity -d c2cloud -t bwp_lg_pre_increase_bsc --prefix pib
./bin/midway-auto -o ./output -n preIncreaseBsc  -a 出入库预增减表头 --ak    -t bsc --mn bwp --an lingang

## 生成表体
./bin/sequelize-auto -h pc-uf6e83x2j0m347qu1.mysql.polardb.rds.aliyuncs.com -u c2cloud  -x App#3220 -o ./output --op 5 --em item -d c2cloud -t bwp_lg_pre_increase_dt --prefix prd
./bin/midway-auto -o ./output -n preIncreaseDt  -a 出入库预增减表体 --ak pibUid   -t item --mn bwp --an lingang

./bin/sequelize-auto -h pc-uf6e83x2j0m347qu1.mysql.polardb.rds.aliyuncs.com -u c2cloud  -x App#3220 -o ./output --op 5 --em item -d c2cloud -t bwp_lg_pre_increase_inexp --prefix pri
./bin/midway-auto -o ./output -n preIncreaseInexp  -a 出入库预增减出入库 --ak pibUid   -t item --mn bwp --an lingang

## 生成聚合根
./bin/midway-auto -o ./output -n preIncrease  -a 出入库预增减 --ak   pibUid  -t aggr --mn bwp --an lingang

