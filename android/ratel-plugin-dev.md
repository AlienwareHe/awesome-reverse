# 平头哥插件开发教程

平头哥插件的含义作用和Xposed插件一致，均可用于对目标App的Hook编写，但平头哥插件还可使用平头哥的相关生态功能，例如：
1. 函数级的指令抽取壳还原
2. 基于Hook实现的自动点击框架SuperAppium和屏幕截图
3. 定时任务管理
4. 插件热发机制

但受限于平头哥原理，平头哥插件只能作用于感染后的应用，无法Hook系统进程例如system_server。

## 平头哥插件

平头哥插件本质是一个普通的安卓APP，和Xposed插件一样（平头哥也兼容了Xposed插件，支持直接加载），插件需要在AndroidManifest.xml中加上一些meta-data属性来让平头哥知道哪些APP是平头哥插件，平头哥才能进行插件管理和加载。

平头哥插件中额外注意的文件和标识属性如下所示，如遇到插件不生效等问题请检查以下配置是否正确，建议使用[官方工具](https://github.com/virjarRatel/ratel-module-template)生成插件进行修改。

- AndroidManifest.xml中meta-data属性
  - xposedmodule
  - xposedminversion
  - for_ratel_apps 关键属性，标识插件作用于哪个目标APP，如果对所有APP生效，不填写该属性即可
  - xposeddescription
  - virtualEnvModel 关键属性，标识目标APP采用哪种分身模式：MULTI/DISABLE/START_UP
  
- src/main/assets/xposed_init
  - 标识插件的入口类即IRposedHookLoadPackage的实现类的全限定名
- src/main/assets/ratel_scheduler.json
  - 定时任务管理文件，描述插件自定义的定时任务调度时间和执行入口
  - taskImplementationClassName 任务实现类，是java的class，比如是com.virjar.ratel.api.scheduler.RatelTask的实现类
  - cronExpression 任务执行的时间规则，配置使用cron表达式规则
  - maxDuration 任务超时时间，单位为秒，也即当任务执行达到超时时间后，框架仍然没有收到任务结束消息，那么框架会强行干预，默认10分钟
  - restartApp 该任务是否需要强制重启app，如果为true，那么任务调度前会杀死app.该配置默认为true

## 使用脚本创建平头哥插件

可以通过自己创建一个安卓项目来编写平头哥插件，也可以使用平头哥提供的脚本工程一键创建插件工程：

https://github.com/virjarRatel/ratel-module-template

在工程根目录下执行./template.sh $params即可生成插件子模块，脚本支持的参数有：
```
-m: 指定插件模块名称，不可为空
-p: 可为空，指定插件生效的目标应用包名
-h: 输出命令帮助文档
...
```

更多使用方式或定制需求请参考[源码](https://github.com/virjarRatel/ratel-module-template/blob/master/createhelper/src/main/java/com/virjar/ratel/createhelper/Main.java)