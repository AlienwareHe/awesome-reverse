QContainer中除了涉及到Java层的Hook，例如在设备指纹模拟时，为了对抗对方的采集方式，通常会在尽可能底层的地方进行hook，因此QContainer还用到了许多Native Inline Hook，Native Hook在使用上比Java层要更复杂一些，因此额外介绍一下QContainer中如何进行Native Hook，防止对native层无从下手。

# SO HOOK技术
安卓中的SO就是个ELF文件，且安卓也基于Linux，因此安卓中的SO技术与Linux中基本一致，大致可分为：
- 导入表Hook（PLT/GOT表Hook）有较好的性能，中等的实现难度，但其只能 Hook 动态库之间的调用的函数，并且无法Hook 未导出的私有函数。非常典型的Hook技术，可以学习到ELF格式、动态链接机制等
- Inline Hook 有很好的性能，并且也没有 PLT 作用域的限制，实现难度高，且需要hook的目标方法的指令长度大于8或12字节的限制。
- Trap Hook 通过ptrace()和signal信号机制进行hook，涉及到系统态和用户态的切换，性能较差。
- 异常Hook Inline Hook的优化版，只需4字节即可完成hook

感兴趣可以深入学习其中GOT表和inline hook的大致原理～

# Substrate Hook
由于集成了VA代码，因此项目中默认使用的是Substrate库，该库是一个典型通用的inline hook技术实现，支持调用原方法，使用方式较简单，例如：
```
// 声明原始函数方法指针，用于保存原始方法
int (*old_system)(const char *__command);

// 声明替换后的新函数
int new_system(const char *__command) {
    ALOGI("libc.so system func exec command:%s", __command);
    return old_system(__command);
}

// 开始hook
void FingerPrintFaker::hook_shell_exec() {
    // 找到待hook函数的符号
    void *handle = dlopen("libc.so", RTLD_NOW);
    void *system_symbol = dlsym(handle, "system");
    ALOGI("libc.so system function find result:%d,%d", handle == nullptr, system_symbol == nullptr);
    // 将函数符号、新函数地址和原始函数地址传入
    MSHookFunction(system_symbol, (void *) &new_system, (void **) &old_system);
    dlclose(handle);
}
```

使用上很简单，声明原始函数和hook函数，在hook函数中通过声明的原始函数调用原函数。

但是在实际使用上，需要注意Inline hook的限制，因为inline hook原理是通过修改目标方法的汇编指令的开始处的几个字节的代码（Substrate中为12个字节），用一段跳转指令来完成目标方法的hook替换，因此inline  hook的最大缺点为需要目标方法足够大，否则会导致替换跳板指令后后续指令紊乱。

如果遇到这种情况，可以将目标SO拉到本地，使用IDA打开，找到目标函数判断目标函数指令长度是否过短，通常出现在系统函数上，例如__system_property_get在安卓9.0后的优化，如果在4字节之上，可以考虑使用**SandHook的异常Hook**，否则只能使用GOT表Hook例如XHook。

# SandHook 异常Hook
来看一下异常Hook的用法，与Substrate十分类似，不同的地方在于原函数指针通过返回值获取，需要自行强转。
```
int (*origin_system_property_get)(const char *name, char *value);

int new_system_property_get(const char *name, char *value) {
    int len = origin_system_property_get(name, value);
    string sname = string(name);
    if (fakeProperties.find(sname) == fakeProperties.end()) {
        return len;
    }
    // 替换value时长度最多不会超过原value长度
    string fake_value = fakeProperties[sname];
    if (strlen(value) > 0) {
        memcpy(value, (char *) fake_value.c_str(), strlen(value));
    }
    ALOGI("hook native system_property_get, key:%s,fake value:%s,length:%d", name, value, len);
    return len;
}

void FingerPrintFaker::hook_system_property_get(map<string, string> fakeProps) {
    fakeProperties = fakeProps;
    void *handle = fake_dlopen("libc.so", RTLD_NOW);
    void *symbol = fake_dlsym(handle, "__system_property_get");
    // 安卓9.0该函数汇编代码长度过短不满足12字节导致substrate inline hook崩溃
    // 因此使用SandHook SingleInstHook，只需要4字节
    if (SDK_INT < 28) {
        MSHookFunction(symbol, (void *) &new_system_property_get,
                       (void **) &origin_system_property_get);
    } else {
        void *origin_back_up_method = SandSingleInstHook(symbol,
                                                         (void *) &new_system_property_get);
        ALOGI("sand single inst hook libc __system_property_get :%d",
              origin_back_up_method == nullptr);
        if (origin_back_up_method == nullptr) {
            ALOGE("sand single inst hook libc __system_property_get failed!!!");
        } else {
            origin_system_property_get = reinterpret_cast<int (*)(const char *,char *)>(origin_back_up_method);
        }
    }
    fake_dlclose(handle);
}
```