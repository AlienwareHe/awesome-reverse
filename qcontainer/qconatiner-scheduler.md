# QContainer定时调度任务
QContainer调度任务框架是对标平头哥的调度任务功能的基础上开发而成，为代码点击UI驱动提供了脱离电脑USB控制的功能，目前已100%实现了平头哥的调度任务功能：

- cron表达式配置
- 支持调度参数传递
- 无需root
- 无需引入其他APK，与平头哥或QContainer天然集成
- 无需其他设备支持，仅需要手机
- 并且在细节上进行了完善：
  - 设计上支持进程粒度级别的定时任务配置
  - 任务取消逻辑（避免唤醒APP）
  - 可定制源码

# 框架设计
考虑任务长期稳定执行,(app保活，进程永生)。带有代码注入的app相对于普通app来说重很多，包括多套api使用，hook方式导致的状态和对象维护管理。hook侵入导致app本身闪退了增加等。以及可能不合理的代码导致app卡死。如果发生app闪退或者卡死，那么我们的框架同样无法运行。框架无法突破Android本身系统权限，无法自动重启自身，或者检测自己处于僵死状态然后自杀。

因此为了能够在目标APP未启动时实现定时任务调度和APP的唤醒，定时调度功能的实现依赖于QContainer-Manager和目标APP之间的共同交互。

# 概念解释
QContainer-Manager
管理qcontainer插件启用状态的管理端app

# 目标APP
qcontainer侵入后的目标业务app，也是插件所附着的app

# 框架交互流程
以需要重启目标APP的调度任务配置的单次定时任务启动流程为例：

![image](http://oss.alienhe.cn/20200923153644.png)


# 框架使用
## 1. 插件配置
增加assests/camel_scheduler.json配置文件，该文件用于配置定时任务的相关参数：

[{
  //任务实现类，是java的class，是com.camel.api.scheduler.RatelTask的实现类
  "taskImplementationClassName": "com.crack.camel.scheduler.MtTaskScheduler",
  // 任务执行的时间规则，配置使用cron表达式规则，有一个特殊的规则就是ratelScheduler不支持秒级调度，对于秒级配置无法起到效果。这是因为正常一个app打开就是秒级耗时的
  "cronExpression": "* * * * * ?",
  // 任务超时时间，单位为秒，也即当任务执行达到超时时间后，框架仍然没有收到任务结束消息，那么框架会强行干预。
  // 框架动作包括强行进行下一次调度、强杀目标app进程等。该配置不是强制填写，默认值为10分钟
  "maxDuration":600,
  // 任务是否需要强制重启app，如果为true，那么任务调度前会杀死app.该配置默认为true
  "restartApp": true
}]
定时任务支持配置多个，如果多个定时任务时间点存在冲突，由于 APP无法并行执行，框架会随机选择某个任务执行。

## 2. 定时任务接口实现
public interface CamelTask {

    /** * 执行调度任务 * <br> * 该任务发生在目标app中 * * @param params 调度任务参数 */
    void doTask(Map<String, String> params);


    /** * 加载调度任务参数，每次调度任务执行之前，可能需要初始化任务相关参数。 * <br> * 非常重要的是，这次调用发生在manager进程,你不能将加载好的数据放到静态变量或者当前进程内存中，否则整个调度过程可能由于app重启导致内存数据丢失 * <p> * * @return 任务参数map, KV均为字符串,可为空 * @throws CamelTaskCancelException 若想要中止本次任务执行，可在该方法中抛出该异常 */
    Map<String, String> loadTaskParams() throws CamelTaskCancelException;
}

每个定时任务对应一个CamelTask实现，需要注意的是虽然是在同一个类中声明，但是doTask方法和loadTaskParams方法执行时所在的进程并不是同一个，同时还需注意doTask方法执行时所在的classLoader与插件代码所属的classLoader也并不是同一个。

## 3.doTask生命周期
doTask方法的调用时机有两个时间点：

如果是restartApp=true，也即app重启类型任务，doTask发生在app启动后，app逻辑执行之前。和xposed模块代码回调发生在同一时机。你可以在doTask完成任何Xposed模块加载时的任务逻辑(实际上在框架层面doTask调用就在Xposed模块加载之前)
如果是restartApp=false,也即app即时类型任务，doTask发生在app运行的任何时机。框架会通过IPC机制，直接调用目标进程的回调函数
## 4.任务结束
由于定时任务的执行是在另一个APP中异步执行，因此任务的结束状态需要在另一个 APP中主动通知manager，通知方法如下 ：

CamelToolKit.camelSchedulerTaskHandler.finishedTask();

如果任务执行完成，但是业务并没有主动通知框架任务执行结束，那么框架将会等待到任务超时。

# 框架具体设计实现
定时调度Server端
QContainer-Manager在角色上相当于调度框架的server端，用于管理设备中所有插件配置的定时任务，同时还提供了唤醒和杀死APP的功能。

类比QSchedule的调度功能，除了能够定时执行，还可以在每次启动时传递相应的参数，对应到在代码点击的业务中，就是向调度端拉取本次抓取的酒店信息。 拉取信息的操作可以运行在manager中，也可以运行在目标app例如美团中，但是由于并不是每次拉取都能获取到待抓取酒店信息，因此为了避免在未成功拉取酒店信息时仍打开APP的操作，将调度任务的参数获取逻辑放在了manager中执行，在确认了可以启动APP之后，再将调度参数传递给目标APP。

此外，杀死APP功能本质上上由目标APP所实现，因为在未突破系统权限 的情况下，其他APP进程无法做到杀死其他进程，只能交由目标APP自己完成自杀操作。

因此在交互上，就需要至少能够实现

- manager端向目标app端传递调度参数（ContentProvider实现 ）
- manager端向目标app端传递自杀命令（匿名binder实现）
    两者虽然传递参数和方向都很相似，但是实际上采用了两种不同的实现方式。
- manager端向目标app端传递调度参数
- manager端向目标app端传递自杀命令
- 定时任务状态判断
- 定时任务运行中&&目标APP运行中
- 任务是否超时
- 超时则重启APP并执行任务
- 定时任务运行中&&目标APP未运行
- 启动APP执行任务
- 定时任务未运行
- 直接执行任务或重启APP再执行任务