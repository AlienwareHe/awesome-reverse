# 常见的风控体系
一般风控体系会分为三层结构来覆盖和贯穿业务全流程的动态防控能力，在终端设备上，通过设备指纹体系进行设备信息采集、终端智能计算和云端的风险分析，为每一个用户的设备生成丰富的风险标签供业务决策使用。在用户操作业务过程中，通过决策引擎为每一笔交易计算风险等级。为了保证决策引擎策略的丰富度和高效率，可以通过实时计算系统做指标计算，决策引擎可以通过各类指标快速完成全局策略的计算。当欺诈案件发生时，我们会形成完整的分析结论并整理到案件库，同时对相关证据做溯源和存证，用于后续可能的司法流程。

风控结构：
- 终端风控
  - 设备指纹
  - 生物探针
  - 智能验证码
- 分析决策
  - 实时指标计算
  - 风险态势感知
- 数据画像
  - 黑产事件信息
  - 黑产资源数据库
  - IP黑名单
  - 设备画像

## 主动式与被动式设备指纹
主动式的方法是通过SDK（App）/JS主动收集设备特征信息，根据算法生成唯一的设备指纹ID。这种方式的优点是准确率相对较高，但因隐私和安全性而受限制，而且随着时间的推移，在数据隐私安全保护越来越严格的大趋势下限制可能会越来越多。该方式的另一个缺点是不能跨app和浏览器识别，而且相关设备数据易被篡改。

被动式的方法是基于通信OSI协议栈、网络状态特征等识别（数据报文），结合机器学习算法来对设备进行跟踪和标记。该方式仅收集用户允许的公开信息，存在技术壁垒，部分领域准确率较高，但从业界实践来看，其准确度受到时间维度限制。

混合式的方法在识别率、应用场景和对抗性三方面平衡了主动式和被动式的方法。

https://sec.zto.com/blog/R23Byx3jEemMXABQVoQXxQ
https://blog.51cto.com/12755572/2049360

## 生物探针
不同于设备指纹通过采集硬件信息，生物探针主要是搜集用户行为，例如采集用户使用智能终端设备（如手机、电脑等）时的传感器数据和屏幕轨迹数据，然后通过特征工程、机器学习，为每一位用户建立多维度的生物行为特征模型，生成用户专属画像进行人机识别、本人识别。

因此生物探针类型在模拟上更加复杂，主要是传感器数据的搜集，对于一些手机墙的群控设备可能是致命弱点，QContainer目前还只是针对设备指纹进行了对抗。

# 二、APP主动式设备指纹
下述已勾选的选项为QContainer已模拟的信息，具体源码可查看QContainer项目com.camel.runtime.fingerprint.VirtualFingerPrintController#build入口，为了使各项设备指纹模拟做到可插拔和扩展，采用的是类似工厂模式的设计，每项均对应一个Processor，方便后续维护。
![image](http://oss.alienhe.cn/20200923145928.png)

PS：QContainer目前的设备指纹模拟宗旨是在同一个机型中做尽可能合理的范围随机波动，例如不修改机型信息、基站仅在周围小区间跳动等。因此可能会导致存在若对机型通杀时，无论如何新机都无法洗白的问题，此时可以尝试修改机型或修改更多信息。

* [x] 地理位置（GPS&基站&WIFI定位&运营商提供的API接口定位
）
* 手机号
* [x] iccSerialNumber subscriberId line1Number imei(imei有校验规则) meid
* [x] WIFI信息（Wifi名称、BSSID、WIFI网卡MAC地址[wlan0、eth0、/sys/class/net/wlan0/address]）
* [x] 传感器，目前仅模拟名称，尚未有合理的模拟思路
* [x] 媒体存储（图库和音乐）
* [x] 应用列表&风险应用屏蔽
* [x] 蓝牙
* [x] SystemProperties#get
* [x] 系统信息（build.prop）
* [x] 屏幕亮度
* [x] 电池电量&充电状态
* 美团APP矩阵（ContentProvider）
* [x] 开机时间 &  APP安装时间
* [x] VPN检测，包括connectivityManager NetworkCapabilities的和NetworkInterface tun0 pptp0和Linux文件/sys/class/net/tun0
* 存储空间泄漏： sdcard交换文件（见app矩阵联盟），sdcard存储id,内部文件修改权限为777(低版本手机SeLinux没有限制)
* app申请android.provider.Settings.System写入权限后，可以往android.provider.Settings.System写入ID
* [移动安全联盟补充设备ID如OAID等](http://msa-alliance.cn/col.jsp?id=120)
![](https://tva1.sinaimg.cn/large/0082zybply1gc8o0hqg3qj30kf0d1jsp.jpg) 

![](https://tva1.sinaimg.cn/large/0082zybply1gc8oq5tmo9j30jh0e1tex.jpg)
* [x] 各种时间，由于是毫秒值，只要碰撞都可以被关联增加权值，包括系统开机时间(区分java层和Linux内核层)，app安装时间（包括base.apk的最后修改时间和packageManager的调用结果），其他app的安装时间（比如微信的安装时间），相册文件时间(正常人相册一定有内容且相册前几张照片几乎不会被删除)
* [x] 各种大小，由于同一个批次的手机的各种硬件有细微差异，所以大小也可以作为设备指纹标记。sdcard磁盘大小android.system.StructStatVfs
* [x] 内存空间大小 （包括ActivityManager.MemoryInfo,和linux层 /proc/meminfo）
* [x] Linux内核相关的文件,如bootid(每次开机都会产生的一个唯一ID,/proc/sys/kernel/random/boot_id"),/proc/sys/kernel/osrelease,老版本的Android还有sdcard对应的设备句柄：/sys/block/mmcblk0/device/cid 各种网卡描述文件: /sys/class/net/eth0/address /sys/class/net/eth1/address /sys/class/net/wlan0/address /sys/class/net/wifi/address
* [x] 手机序列号 不同版本的Android序列号获取姿势不一样，考虑多种版本的序列号拦截方案
* app矩阵，也即多个app相互开放接口通信，实现设备号交换。
* 同一个集团的各种app进行ID交换，如头条系
* 第三方sdk相互通信，进行ID交互，如友盟，百度定位

    交互方式，包括文件权限(chmod 777),contentProvider,IPC，本地socket等
* Android官方的accountManager，可以存储账号数据，如系统邮件账号
* 命令行绕过，如linux命令,echo "the_id" > /sdcard/m_id   重启后 :cat /sdcard/m_id
* 命令行IPC调用，adb shell service  call  https://blog.csdn.net/u014711665/article/details/91875959
* ip link

# 三、GPS定位
## hook点：
1. android.telephony.TelephonyManager#getCellLocation
2. android.telephony.PhoneStateListener#onCellLocationChanged
3. android.telephony.PhoneStateListener#onCellInfoChanged
4. android.telephony.TelephonyManager#getAllCellInfo
5. LocationManager#getLastLocation
6. LocationManager#getLastKnownLocation

## 基站
只漂移相邻小区，不更改网络制式和服务商信息等。

基站信息简单的说是由LAI(Location Area Identification) + CID(Cell Identity)组成的, LAI由(MCC +MNC+LAC)组成其中MCC全名Mobile Country Code，移动国家码，三位数，如中国为460。MNC全名Mobile Network Code，移动网络号，两位数。LAC全名Location Area Code，是一个2个字节长的十六进制BCD码(不包括0000和FFFE)。Cell Identity 小区码，同样是2个字节长的十六进制BCD码。

因此模拟时需要注意随机数字和字符需要按照十六进制和CID长度规范。

同时，由于基站的误差大约在五百米，因此在漂移小区时尽量避免漂移太多导致失真，在模拟时波动范围在上下3左右。

# 四、IMEI/MEID
分为CDMA和GSM制式，与设备绑定。由十五位十六进制数字组成，有严格的校验规则，IMEI与MEID的校验算法不一样，但最后一位均为校验位。

## hook点
```
        addImeiHook(virtualBaseInfo, TelephonyManager.class, "getDeviceId");
        addImeiHook(virtualBaseInfo, TelephonyManager.class, "getImei");
        addImeiHook(virtualBaseInfo, TelephonyManager.class, "getMeid");
        addImeiHook(virtualBaseInfo, XposedHelpers.findClass("com.android.internal.telephony.PhoneSubInfo", CamelRuntime.sContext.getClassLoader()), "getDeviceId");
        addImeiHook(virtualBaseInfo, XposedHelpers.findClass("com.android.internal.telephony.PhoneSubInfoProxy", CamelRuntime.sContext.getClassLoader()), "getDeviceId");
        addImeiHook(virtualBaseInfo, XposedHelpers.findClass("com.android.internal.telephony.gsm.GSMPhone", CamelRuntime.sContext.getClassLoader()), "getDeviceId");
```

# 五、IMSI
与SIM卡绑定，用于区分移动用户标识，由MCC + MNC + MSIN(在中国10位)组成，一般总共15位，所以在模拟时只能模拟后十位。

##  hook点
```
        addImsiHook(virtualBaseInfo, TelephonyManager.class, "getSubscriberId");
        addImsiHook(virtualBaseInfo, XposedHelpers.findClass("com.android.internal.telephony.PhoneSubInfo", CamelRuntime.sContext.getClassLoader()), "getSubscriberId");
        addImsiHook(virtualBaseInfo, XposedHelpers.findClass("com.android.internal.telephony.PhoneProxy", CamelRuntime.sContext.getClassLoader()), "getSubscriberId");
        addImsiHook(virtualBaseInfo, XposedHelpers.findClass("com.android.internal.telephony.gsm.GSMPhone", CamelRuntime.sContext.getClassLoader()), "getSubscriberId");
        addImsiHook(virtualBaseInfo, XposedHelpers.findClass("com.android.internal.telephony.PhoneSubInfoProxy", CamelRuntime.sContext.getClassLoader()), "getSubscriberId");
```

# 六、ICCID
SIM卡标识，规定由20位数字组成，但各个国家地区的规范也不一定遵守，在中国一般前七位为运营商标识，因此模拟时保证前七位不变。
# hook点
* android.telephony.TelephonyManager#getSimSerialNumber

# 七、电量
按照一天中电量逐渐衰减的算法进行模拟：
> batteryLevel = 98 - currentTime * a + random (0 <= currentTime < 86400, 10 < batteryLevel < 100, 0<= random <=2)

# 八、VPN
## hook点
* connectivityManager
* NetworkCapabilities的和NetworkInterface tun0 pptp0
* Linux文件/sys/class/net/tun0

# 九、媒体存储（图库和乐库）
由于图片和音乐文件每个人均不相同，而且文件的修改时间、大小、名称等均可以作为指纹进行参考，因此对媒体文件的ContentResolver查询相关类进行了代理。

# 十、应用列表
* 风险应用如xposed等，之前发现到过美团有着自己评估的风险应用列表
* 应用列表打乱及随机展示，美团会搜集前十条应用列表作为指纹依据之一，所以尽量避免一个手机的每个分身应用列表均不一致。
* 应用安装时间及最近修改时间，时间戳是作为指纹的有力得分。

# 十一、内存大小
虽然同一个机型的内存大小一般都是相同的配置，但是实际上精确到KB或者字节时，不同硬件的大小实际上会有细微差别，因此这类大小也可能被用于作为指纹。

对于内存大小除了常见通过ActivityManager获取，实际上还可以通过系统文件/proc/meminfo获取，所以需要将该文件重定向至我们模拟的文件当中。
## hook点
* /proc/meminfo
* ActivityManager#getMemoryInfo

## /proc/meminfo
```
MemTotal:        2893928 kB
MemFree:          263152 kB
MemAvailable:    1219116 kB
Buffers:           83340 kB
Cached:          1018700 kB
SwapCached:        13284 kB
Active:          1110600 kB
Inactive:         517744 kB
Active(anon):     443208 kB
Inactive(anon):   211616 kB
Active(file):     667392 kB
Inactive(file):   306128 kB
Unevictable:      120548 kB
Mlocked:          120548 kB
SwapTotal:       1048572 kB
SwapFree:         305352 kB
Dirty:                12 kB
Writeback:             0 kB
AnonPages:        638088 kB
Mapped:           278096 kB
Shmem:              8228 kB
Slab:             222072 kB
SReclaimable:      88824 kB
SUnreclaim:       133248 kB
KernelStack:       42240 kB
PageTables:        65136 kB
NFS_Unstable:          0 kB
Bounce:                0 kB
WritebackTmp:          0 kB
CommitLimit:     2495536 kB
Committed_AS:   102753676 kB
VmallocTotal:   258998208 kB
VmallocUsed:      313204 kB
VmallocChunk:   258553348 kB
```

# 美团&携程中的设备指纹搜集点
为方便后续继续对抗美团和携程的设备指纹，这里记录一下目前美团和携程设备指纹的搜集类方法信息，后面版本更新之后可以作为线索快速定位。

美团：
- com.meituan.android.common.fingerprint.FingerprintManager#fingerprint
- com.meituan.android.common.dfingerprint.collection.a#a(boolean)
- com.meituan.android.common.datacollection.DataProcessor#startCollection

携程：
- ctrip.android.hotel.view.common.tools.HotelUtils#getNewData
- ctrip.business.sotp.LoadSender#getDeviceProfileInfo