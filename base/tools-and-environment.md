# 逆向入门工具及环境搭建
## 工程项目介绍
- [ratel-qunar-crack](http://gitlab.corp.qunar.com/kykm/ratel-qunar-crack)
- [QContainer](http://gitlab.corp.qunar.com/kykm/QContainer)
- [protocol-crack](http://gitlab.corp.qunar.com/kykm/protocol-crack)
- [magic-service](http://gitlab.corp.qunar.com/kykm/magic-service)
- [g4proxy](http://gitlab.corp.qunar.com/kykm/g4proxy)

## ratel-qunar-crack
所有基于平头哥或QContainer容器的hook插件代码仓库，其中每个module为一个插件，若为QContainer插件则以-camel后缀进行标识。

**更多详细信息请参考参考项目下README.md！！**

这里介绍几个重要的规范和开发技巧：
- 插件开发最终产物为插件APK，不需要线上发布，但每次需求迭代时需要更新build.gradle下的versionName和versionCode，并记录每次版本更新内容，例如:

![image](http://oss.alienhe.cn/20200917185241.png)

- 新建插件module，项目下有一个脚本template.sh可以快速新建一个插件module，但是目前仍为平头哥插件模版，对应crack-demo工程，后续可以更新成QC插件模版，具体使用方式参考项目README。
- 自动点击插件典型DEMO：crack-ctrip-superappium-camel
- Sekiro RPC插件典型DEMO：crack-meituan-hermes
- Go RPC插件典型DEMO：crack-ctrip-rpc
- Hook插件典型DEMO：crack-ctrip
- 系统通知栏监听小APP：detect-my-phone

## protocol-crack & magic-service
这俩工程都是全协议抓取模式的工程，通过纯服务器进行抓取，两者的区别在于protocol-crack早期是为了美团APP全协议创建以及为其他APP全协议做准备，目前所支持的协议已有：
- 美团APP
- 艺龙酒店Touch及验证码登录协议
- 携程PC酒店（eleven参数）
- 携程Touch酒店（crawlerKey参数）
- 携程门票搬单链路
- 携程登录协议（短信验证码、登录、滑块）

## g4proxy
该工程为一个安卓APP工程，主要作用为：
1. slave信息上报
2. 4G代理agent
该APP作为4G代理的原理与Sekiro RPC的方式类似，均为通过一个Netty TCP长链接作为内网穿透和请求转发通道。

## JS逆向工具链
- Chrome
- SwitchyOmega Chrome插件，用于设置charles或fiddler代理
- Chrales/Fiddler 用于PC和APP的抓包
- 油猴插件 用于JS Hook
- Node环境
- [WxAppUnpacker](https://github.com/xuedingmiaojun/wxappUnpacker) 小程序包反编译工具

## 安卓逆向工具链
这里只介绍工作中会用到的一些工具和开发环境，基于这些也足以应付大部分安卓逆向。
### 反编译
- （推荐）[JADX](https://github.com/skylot/jadx)：开源、稳定、有GUI界面
- apktool 常用于反编译smali代码
- JEB
- IDA Pro（一般用于调试SO文件）
- 010 Editor（查看二进制文件，查看ELF/Dex文件格式、AndroidManifest.xml文件反编译失败时可以用上）
- HttpCanary 基于VPN的抓包APP
- MT管理器 安卓上一款功能丰富包括APK反编译、DEX重构等功能的文件管理APP
- file\objdump等Linux命令 （PS.不要相信文件后缀名，要基于文件特征多维度校验）

### 开发环境
- android studio
- android sdk/ndk
- gradle 安卓中全部使用gradle而非maven构建项目

### JADX使用技巧
对于小APP，可以直接直接拖拽源APK进JADX-GUI，快速得到反编译结果。

对于大APP或者需要经常分析源码的，还是建议使用命令行反编译，并加上--no-imports参数，取消import导入，因为混淆后的APP代码中充斥大量A、B、C类，使用全限定名利于分辨，然后在android studio中进行打开，在交叉引用等分析上会方便很多。

在使用命令行反编译时，大型APK时需要较大内存例如美团，可能会出现不断陷入GC的情况导致反编译卡死，一个解决方案是更改JADX配置调整内存，另一个则是对APP中的每个DEX分开编译然后合并至一起（适用于16G小内存电脑，通用方案）。这里给出自己写的一个自动Shell脚本，主要功能为：
- smali代码反编译
- java代码反编译
- 分DEX编译

```
#!/bin/bash
while getopts "d:o:" arg
do
	case $arg in
		d)
			apkPath=$OPTARG
			apkName=${OPTARG##*/}
			apkName=`basename $apkPath .apk`
			;;
		o)
			outputDir=$OPTARG
			;;
		?)
			echo "unsupported argument"
	esac
done

if [ x"$apkPath" = x ];then
	echo "hello~ please input your apk path..."
	exit 1
fi

if [ x"$outputDir" = x ];then
	outputDir="$apkName"_jadx 
fi

codePath=$outputDir"/code"
apkZipTemp="$outputDir"/"$apkName".zip
apkToolPath=$outputDir"/apktool"

echo "source apk path:"$apkPath
echo "source apk name:"$apkName
echo "decompile result path:"$outputDir
echo "decompile code path:"$codePath
echo "apktool decompile path:"$apkToolPath


mkdir $outputDir

cp $apkPath $apkZipTemp

unzip -o $apkZipTemp -d $outputDir > /dev/null
mkdir $codePath

index=1
for file in `ls $outputDir`
do
	if [ x"${file##*.}" = x"dex" ];then
		jadx -j 1 -r --no-imports -d "$codePath"_"$index" $outputDir/$file
		# rsync中目录路径带/表示将所有文件复制到目标目录下，而非复制文件夹 
		rsync -a "$codePath"_"$index"/ $codePath
		# 删除临时目录
		rm -rf "$codePath"_"$index"
		let index++
	elif [[ $file == code* ]];then
		echo $file
	else
		# 其余文件删除
		echo "rm -rf $file"
		rm -rf $file
	fi
done

apktool d $apkPath -o $apkToolPath

rm -rf $apkZipTemp
```

