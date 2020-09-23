# 目标
实现Hook插件可以及时自动更新至最新版本（或特定版本）插件，无需人工覆盖安装插件。

# 架构角色
客户端（感染应用和hook插件）

服务端（插件市场）

# 思路
* 什么时机判断插件是否需要更新
* 插件更新是在感染应用中还是在manager中
* 能否做到直接按照感染app直接拉取对应插件，而无需本地安装插件
* 一个APP对应多个插件如何处理
* 拉取插件更新时网速过慢是否会影响APP启动
* 插件更新管理服务端对接规范

# 插件热更新流程
![image](http://oss.alienhe.cn/20200910150946.png)

# 插件更新规范文档
插件可通过配置对接的接口地址来控制请求的服务端地址，实现服务端的动态配置。但同时也要求服务端必须实现同一套接口规范。

## 服务端

### 查询插件最新版本 GET
请求参数：

参数名 | 是否必需 | 示例 | 备注
---|--- | --- |---
packageName | True | com.crack.ctrip |

响应格式：

JSON

```
示例：
{
	"packageName":"com.crack.ctrip",
	"latestVersion":"1.3",
	"downloadUrl":"http://xxxxx"
}
```

参数名 | 类型 | 示例 | 备注
---|--- | --- |---
packageName | String | com.crack.ctrip |
latestVersion | String | 1.3 | 
downloadUrl | String |  |


## 客户端插件模块
支持热发更新的插件模块与普通插件没有太大区别，但需要通过meta标签来标识和指定是否是热发插件，即热发插件服务端地址。

```
        <!--是否是一个热发插件-->
        <meta-data
            android:name="isHotModule"
            android:value="true" />
        <!--热发插件服务查询的服务端地址-->
        <meta-data
            android:name="hotModuleServerUrl"
            android:value="htps://xxx.com/xxx" />
```

# QContainer内部实现原理
从本质来看，在原来的从已安装APP列表中加载插件时的流程是，根据插件安卓路径获取插件APK，然后通过DexClassLoader动态加载插件入口类，因此对于热发插件来说，只是获取插件APK的方式有所变化，需要变更为首先检查插件版本，然后检查本地最后判是否要下载最新插件。

除了在runtime中需要判断上述的流程之外，还有一个地方容易被遗漏，即manager中的定时任务。定时任务机制中也会解析插件中的CamelTask并缓存，因此若想要插件做到完全更新，还需要在manager中进行上述的版本判断和更新操作。

# 局限性
- 联网 由于涉及到联网下载，因此需要感染APP自带联网权限申请，否则会导致插件无法下载。
- 本地已安装初始插件APP