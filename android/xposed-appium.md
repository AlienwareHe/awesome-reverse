# XposedAppium

## 简介:
基于Xposed做的一款自动化点击，滑动框架（基于安卓原生的事件分发），可以模拟手指的一切操作 。
基于Xpath表达式获取View。

## 实现原理：

通过Hook Application->dispatchActivityResumed（也可以Hook Activity的 onResume），包括Fragment里面的onResume等来监听页面的切换。实现执行自己的逻辑。

## 使用注意
### 自带重试机制
框架自带有重试机制，ActivityFocusHandler#handleActivity的返回值就代表了本次 activity
触发的事件处理结果是否成功，若处理失败则会经过PageTriggerManagger#taskDuration时间后重新触发，因此可以通过return false来进行重试，无需自己sleep重试，减少非主线程操作UI的可能。

## Api介绍

有两个常用的类 PageTriggerManager 和 ViewImage

| PageTriggerManager             |                                                        |
| ----------------------- | ------------------------------------------------------ |
| getContext()            | 获取当前Application的Context                           |
| getClassloader()        | 获取当前Application的ClassLoader                       |
| ActivityFocusHandler    | 需要处理的Activity接口                                 |
| FragmentFocusHandler    | 需要处理的Fragment接口                                 |
| AlertDialogShowListener | 监听对话框Show的接口                                   |
| setTaskDuration         | 设置任务时间间隔，这会影响case执行速度                 |
| setDisable              | 自动化插件的整体开关                                   |
| getMainLooperHandler    | 获取主线程Handler对象                                  |
| SetDialogShowListener   | 设置Show方法回调                                       |
| addHandler              | 添加需要处理的Activity                                 |
| getTopActivity          | 获取当前Activity                                       |
| getTopDialogWindow      | 获取最上层对话框的Window对象可能为Null                 |
| getTopPupWindowView     | 获取最上层PupView                                      |
| tryGetTopView           | 根据Xpath表达式获取ViewImage(对上层的全部View进行遍历) |
| getTopRootView          | 获取最上层的并且显示的View，比如对话框                 |
| getTopFragment          | 获取最上层Fragment                                     |









| ViewImage                  |                                                              |
| -------------------------- | ------------------------------------------------------------ |
| ViewImage(View originView) | 根据一个View生成ViewImage对象                                |
| getType                    | 获取当前View的ClassName                                      |
| getText                    | 尝试获取View的Text                                           |
| setText                    | 尝试对TextView SetText                                       |
| getOriginView              | 获取ViewImage 原始View                                       |
| childCount                 | 获取子孩子的个数                                             |
| childAt                    | 根据位置获取                                                 |
| index                      | 获取位置                                                     |
| getAllElements             | 获取全部的子节点，包括父类，子类                             |
| previousSibling            | 获取上个兄弟节点                                             |
| rootViewImage              | 获取父类ViewImage                                            |
| xpath                      | 查找全部匹配项                                               |
| xpath2String               | 根据xpath表达式拿到对应View里面的具体内容，类似"//android.widget.TextView[@contentDescription='XXXXXXXXXXXXXXXX']/text()" |
| xpath2One                  | 根据Xpath表达式获取ViewImage(对上层的全部View进行遍历，弹窗，Activity，悬浮窗等)，返回第一个匹配项 |
| clickByXpath               | 根据Xpath表达式                                              |
| typeByXpath                | 对 TextView 类型 设置指定内容                                |
| click                      | 点击当前View                                                 |
| swipe                      | 滑动当前View，开始坐标xy，结束坐标xy                         |
| swipeDown                  | 向下滑动，负值为向上                                         |
| toString                   | 打印当前view包括子view的全部属性                             |



## Demo使用说明可参考 :

https://bbs.pediy.com/thread-260992-1.htm#1655864

## Xposed版
https://github.com/w296488320/XposedAppium