## 生成表头
./bin/sequelize-auto -h pc-uf6167ejxjyeqivjn.mysql.polardb.rds.aliyuncs.com -u c2cloud  -x App#3220 -o ./output --op 5 --em entity -d c2cloud -t bwp_lg_pre_increase_bsc --prefix pib
./bin/midway-auto -o ./output -n preIncreaseBsc  -a 预出入库单表头 --ak    -t bsc --mn bwp --an lingang

## 生成表体
./bin/sequelize-auto -h pc-uf6167ejxjyeqivjn.mysql.polardb.rds.aliyuncs.com -u c2cloud  -x App#3220 -o ./output --op 5 --em item -d c2cloud -t bwp_lg_pre_increase_dt --prefix prd
./bin/midway-auto -o ./output -n preIncreaseDt  -a 预出入库单表体 --ak pibUid   -t item --mn bwp --an lingang

./bin/sequelize-auto -h pc-uf6167ejxjyeqivjn.mysql.polardb.rds.aliyuncs.com -u c2admin  -x App#3220 -o ./output --op 5 --em entity -d c2cloud -t bwp_lg_pre_increase_bsc --prefix pib
./bin/midway-auto -o ./output -n preIncreaseInexp  -a 预出入库单出入库 --ak pibUid   -t item --mn bwp --an lingang

## 生成聚合根
./bin/midway-auto -o ./output -n preIncrease  -a 预出入库单 --ak   pibUid  -t aggr --mn bwp --an lingang

