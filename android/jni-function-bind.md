此篇文章想解决的问题是如何在Xposed中进行Native Hook，或者说本质是如何在Xposed插件中编写和实现JNI函数。

实现的问题在于不额外处理的情况下，插件生成的so中在目标app中是无法找到的，此时JNI函数无法找到对应的实现。

所以首先来跟踪一下JNI函数是如何绑定到so中的函数实现，源码版本为android-10.0.0_r41。

# JNI函数执行入口跟踪

JNI函数分为静态注册和动态注册，静态注册通过命名规范绑定Java中声明的JNI函数和C++中的实现函数，动态注册则是通过主动调用RegisterNative方法进行绑定。

首先来看JNI方法的entry_point_from_quick_code是什么（ArtMethod.ptr_sized_fields_结构体），因为这个字段代表Java方法执行时的入口点，对于JNI方法这种没有dalvik字节码的方法来说，入口只能是quick_code。

那么entry_point_from_quick_code这个值赋值逻辑和时机是什么，如果对ART虚拟机类加载流程有所了解，那么应该知道在class_linker的LinkCode中。

该方法中会设置quick_code为对应的跳板，对于JNI方法，则有两步逻辑：
1.  method->SetEntryPointFromQuickCompiledCode(GetQuickGenericJniStub());
2.   method->SetEntryPointFromJni(
        method->IsCriticalNative() ? GetJniDlsymLookupCriticalStub() : GetJniDlsymLookupStub());

即设置entry_point_from_quick_code和data_的值为art_quick_generic_jni_trampoline和art_jni_dlsym_lookup_stub。

## art_quick_generic_jni_trampoline
Art中有许多类似的用汇编写的跳板，该跳转最终会跳到art/runtime/entrypoints/quick/quick_trampoline_entrypoints.cc的artQuickGenericJniTrampoline方法。

该方法的作用便是跳转到data_指向的代码，即art_jni_dlsym_lookup_stub，在安卓10之前还会通过artFindNativeMethod查找JNI方法的Native方法实现。

```
安卓11之后该方法则只是单纯的返回data_即entry_point_from_jni，查找JNI方法实现放在了art_jni_dlsym_lookup_stub中。
```

该方法首先会判断data_是否为art_jni_dlsym_lookup_stub，如果是则说明JNI方法还没有找到实现，于是便调用artFindNativeMethod。

### artFindNativeMethod

JavaVMExt* vm = down_cast<JNIEnvExt*>(self->GetJniEnv())->GetVm();

native_code = vm->FindCodeForNativeMethod(method);

在FindCodeForNativeMethod中核心便是通过libraries_->FindNativeMethod进行查找，查找的具体过程便是通过jni_short_name和jni_long_name在所有已加载的动态库里通过dlsym查找函数，到这里也就解释了静态注册是如何进行函数绑定的。

而libraries则是从JavaVMExt::LoadNativeLibrary中得来，也就说System.loadLibrary时会加载到libiraries中。

## art_jni_dlsym_lookup_stub
该方法也是一个汇编跳板，跳转到artFindNativeMethod函数。

# JNIEnv->RegesterNatives跟踪
这个方法很简单，从art/runtime/jni/jni_internal.cc中阅读源码发现，调用了class_linker->RegisterNative，最终就是把ArtMethod的data_字段也就是entry_point_from_jni设置为了传入的fnPtr。

所以静态/动态注册的JNI函数绑定都和简单，本质就是从所有已加载的so库中查找实现函数并设置到JNI函数的jni入口中。

# Xposed加载so
那么对于Xposed插件或者插件化的APK来说，System.loadLibrary该如何调用呢，或者说so文件应该读取呢。

System.loadLibrary传入的参数为so的名称，然后从classloader.findLibrary进行查找so的全路径，在Art中也就是BaseDexClassLoader通过pathList进行查找，也就是创建classLoader时声明的nativeLibraryDirectories。

如果有root权限就很简单，把so放置在/system/lib或者/system/lib64下，每个app都有权限可以读取。

如果没有root权限，那么根据加载的原理有两个方向:
1. 直接跳过查找so，传入so的全路径，例如调用Runtime.doLoad或者nativeLoad方法
2. 修改ClassLoader的pathList，加入插件当前的so文件夹，例如https://www.jianshu.com/p/8ca56c3ec591


