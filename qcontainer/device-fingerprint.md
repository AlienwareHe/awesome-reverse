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
- 数据画像/情报威胁
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

因此生物探针类型在模拟上更加复杂，主要是传感器数据的搜集，用于生成用户的一些用机习惯，例如设备仰角、持机手势、触摸力度等，这些对于一些手机墙的群控设备可能是致命特征。

# 二、APP主动式设备指纹
这里列举几种QContainer中涉及但不限于的常见的设备指纹：

* [x] 地理位置（GPS&基站&WIFI定位&运营商提供的API接口定位）
* [x] iccSerialNumber subscriberId line1Number imei(imei有校验规则) meid
* [x] WIFI信息（Wifi名称、BSSID、WIFI网卡MAC地址[wlan0、eth0、/sys/class/net/wlan0/address]）
* [x] 传感器列表
* [x] 媒体存储（图库和音乐）
* [x] 应用列表&风险应用屏蔽
* [x] 蓝牙
* [x] SystemProperties#get
* [x] 系统信息（build.prop）
* [x] 屏幕亮度
* [x] 电池电量&充电状态
* APP矩阵（ContentProvider）
* [x] 开机时间 &  APP安装时间
* [x] VPN检测，包括connectivityManager NetworkCapabilities的和NetworkInterface tun0 pptp0和Linux文件/sys/class/net/tun0
* 存储空间泄漏： sdcard交换文件（见app矩阵联盟），sdcard存储id,内部文件修改权限为777(低版本手机SeLinux没有限制)
* app申请android.provider.Settings.System写入权限后，可以往android.provider.Settings.System写入ID
* [移动安全联盟补充设备ID如OAID等](http://msa-alliance.cn/col.jsp?id=120)
![](https://tva1.sinaimg.cn/large/0082zybply1gc8o0hqg3qj30kf0d1jsp.jpg) 

![](https://tva1.sinaimg.cn/large/0082zybply1gc8oq5tmo9j30jh0e1tex.jpg)
* [x] 手机序列号 不同版本的Android序列号获取姿势不一样，考虑多种版本的序列号拦截方案
* app矩阵，也即多个app相互开放接口通信，实现设备号交换。
* 同一个集团的各种app进行ID交换，如头条系
* 第三方sdk相互通信，进行ID交互，如友盟，百度定位
* Android官方的accountManager，可以存储账号数据，如系统邮件账号
* 命令行绕过，如linux命令,echo "the_id" > /sdcard/m_id   重启后 :cat /sdcard/m_id
