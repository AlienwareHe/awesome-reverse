# 逆向入门工具及环境搭建

## JS逆向工具链
- Chrome
- SwitchyOmega Chrome插件，用于设置charles或fiddler代理
- Chrales/Fiddler 用于PC和APP的抓包
- 油猴插件 用于JS Hook
- Node环境
- 小程序包反编译工具:[WxAppUnpacker](https://github.com/xuedingmiaojun/wxappUnpacker)

## 安卓逆向工具链
这里列举一些日常中经常使用到的一些工具和开发环境，基于这些也足以应付大部分安卓APP的逆向。
### 反编译
- （推荐）[JADX](https://github.com/skylot/jadx)：开源、稳定、有GUI界面
- apktool 常用于反编译smali代码
- JEB 在反编译算法上弥补JADX部分代码无法还原的情况，例如多层try-catch嵌套
- IDA Pro（一般用于调试SO文件）
- 010 Editor（查看二进制文件，查看ELF/Dex文件格式、或者在AndroidManifest.xml文件反编译失败时可以用上）
- HttpCanary 基于VPN的抓包APP
- MT管理器 安卓上一款功能丰富包括APK反编译、DEX重构等功能的文件管理APP
- file\objdump等Linux命令 （PS.不要相信文件后缀名，要基于文件特征多维度校验）

### 开发环境
- android studio
- android sdk/ndk
- gradle 安卓中全部使用gradle而非maven构建项目

### Hook工具
APP逆向中离不开的核心思想：hook，可以实现代码动态插桩，修改对方APP中的方法执行逻辑，这里列举几种可以开箱即用的Hook工具。

|Hook框架|是否需要root环境|特点|
|---|---|---|
Xposed|是 | 最经典的Hook框架
EdXposed|Magisk+riru | Xposed安卓8之后不再维护，因此目前8+一般使用EdXposed
VAXposed|否 | 通过VirtualApp实现免root
Frida|免root情况下也可集成frida-gadget.so | 比Xposed更强大的支持Native Hook和Js、Python等语言编写脚本的分析工具
太极|否 | 基于重打包实现的一个类Xposed框架
[Ratel](https://ratel.virjar.com/)|否 | 比太极更加强大的支持应用分身和设备指纹的hook框架
QContainer| 否 | 自研对标Ratel的Hook框架

### JADX使用技巧
对于小APP，可以直接直接拖拽源APK进JADX-GUI，快速得到反编译结果。

对于大APP或者需要经常分析源码的，还是建议使用命令行反编译，并加上--no-imports参数，取消import导入，因为混淆后的APP代码中充斥大量A、B、C类，使用全限定名利于分辨，然后在android studio中进行打开，在交叉引用等分析上会方便很多。

在使用命令行反编译时，大型APK时需要较大内存例如MT/Wexin，可能会出现不断陷入GC的情况导致反编译卡死，一个解决方案是更改JADX配置调整内存，另一个则是对APP中的每个DEX分开编译然后合并至一起（适用于16G小内存电脑，通用方案）。这里给出自己写的一个自动Shell脚本，主要功能为：
- smali代码反编译
- java代码反编译
- 分DEX编译

> 详细介绍见：https://github.com/AlienwareHe/multi-dex-jadx

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

