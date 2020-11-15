因为最近在用EdXposed，对于magisk和riru很是好奇，之前也大致了解过edxp通过riru实现zygote注入进而完成ART Hook实现类Xposed，但是在准备看源码的时候发现不知道入口在哪，本来想找找有没有现成的大佬总结，发现貌似没有，于是秉着努力学习拉近差距的态度，自力更生，从magisk插件开发到riru插件到riru加载逻辑，一步步找到了edxp的代码入口。

# Edxp如何编译成一个Magisk插件
根据面具的官方文档(https://topjohnwu.github.io/Magisk/guides.html)一个Magisk插件模块是/data/adb/modules下的一个文件夹，其中至少包含着以下几个文件：

- module.prop 模块标识
- post-fs-data.sh post-fs-data时所执行的脚本
- service.sh 启动脚本的首选文件

EdXposed在gradle构建出产物时，会将整个项目打包成一个magisk module installer,该installer与magisk module的区别在于installer为一个zip压缩文件，同时包含META-INF文件夹，其中的update-binary.sh将作为安装前执行的脚本。

但是我们在DoraDo中并没有搜到相关的module.prop文件，只能看到module.prop.tpl模版文件，那么这两个文件是如何关联的呢。

在edxp-core的build.gradle中可以看到声明了一系列构建Task，从DoraDo的构建命令./gradlew clean :edxp-core:[zip|push]YahfaRelease开始追踪，

```
def zipTask = task("zip${backendCapped}${variantCapped}", type: Zip) {
                dependsOn prepareMagiskFilesTask
                archiveName "${module_name}-${project.version}-${variantLowered}.zip"
                destinationDir file("$projectDir/release")
                from "$zipPathMagiskRelease"
            }
 
            task("push${backendCapped}${variantCapped}", type: Exec) {
                dependsOn zipTask
                workingDir "${projectDir}/release"
                def commands = ["adb", "push",
                                "${module_name}-${project.version}-${variantLowered}.zip",
                                "/sdcard/"]
                if (is_windows) {
                    commandLine 'cmd', '/c', commands.join(" ")
                } else {
                    commandLine commands
                }
            }
        }
 
        // backward compatible
        task("zip${variantCapped}") {
            dependsOn "zipYahfa${variantCapped}"
        }
        task("push${variantCapped}") {
            dependsOn "pushYahfa${variantCapped}"
        }
```

可以发现 pushTask只是将构建产物推送到设备sdcard下，真正打包任务在zipTask中，其依赖于prepareMagiskFilesTask，该task的作用是：

- 复制template_override目录下的META-INF和so文件
- 替换和重写edconfig.tpl和module.prop.tpl，变成真正的module.prop

```
def prepareMagiskFilesTask = task("prepareMagiskFiles${backendCapped}${variantCapped}", type: Delete) {
                dependsOn prepareJarsTask, "assemble${variantCapped}"
                delete file(zipPathMagiskRelease)
                doFirst {
                    copy {
                        from "${projectDir}/tpl/edconfig.tpl"
                        into templateFrameworkPath
                        rename "edconfig.tpl", "edconfig.jar"
                        expand(version: "$version", backend: "$backend")
                    }
                    copy {
                        from "${projectDir}/tpl/module.prop.tpl"
                        into templateRootPath
                        rename "module.prop.tpl", "module.prop"
                        expand(moduleId: "$magiskModuleId", backend: "$backendCapped",
                                versionName: "$version",
                                versionCode: "$versionCode", authorList: "$authorList")
                        filter(FixCrLfFilter.class, eol: FixCrLfFilter.CrLf.newInstance("lf"))
                    }
                }
                def libPathRelease = "${buildDir}/intermediates/cmake/${variantLowered}/obj"
                doLast {
                    copy {
                        from "${projectDir}/template_override"
                        into zipPathMagiskRelease
                    }
                    copy {
                        from "$libPathRelease/armeabi-v7a"
                        into "$zipPathMagiskRelease/system/lib"
                    }
                    copy {
                        from "$libPathRelease/arm64-v8a"
                        into "$zipPathMagiskRelease/system/lib64"
                    }
                    copy {
                        from "$libPathRelease/x86"
                        into "$zipPathMagiskRelease/system_x86/lib"
                    }
                    copy {
                        from "$libPathRelease/x86_64"
                        into "$zipPathMagiskRelease/system_x86/lib64"
                    }
                }
            }
```

但是EdXposed作为一个Magisk插件，插件加载时所会执行的update-binary、post-fs-data.sh、customize.sh等脚本中并没有相关执行EdXp的命令，那么EdXposed是如何在Zygote进程加载时所执行呢。

EdXposed实际上还是一个riru插件，即基于riru注入zygote进程时机和riru相关的API声明来实现zygote进程执行时的加载。

# Riru模块（插件）编译构建过程
Riru模块本质上是一个Magisk插件，额外的地方在于新增了一个目录/data/adb/riru/modules(旧版本在/data/misc/riru/modules)下多了一个插件目录，该目录的作用在于在riru加载时通过该目录名称加载对应的插件so，具体逻辑下面具体分析。

首先看一个Riru模块如何编译构建的，入口依然是build.gradle，即从构建命令zipMagiskMoudle入手：
> 源码：https://github.com/RikkaApps/Riru-ModuleTemplate/blob/master/module/build.gradle

可以看到主要做了以下操作：
1. 复制$rootDir/template/magisk_module
2. 复制$rootDir/template/magisk_module/riru.sh，替换其中占位符
3. 生成module.prop
4. 在riru目录下生成module.prop.new
5. 复制native动态链接库
6. 生成sha1sum签名
7. zip压缩打包

一句话总结：将项目下template/magisk_module下的如动态库、module.prop、post-fs-data.sh等magisk插件相关文件打包成magisk module install所需的zip格式。剩下的就是安装到手机中由Magisk进行加载。

```

android.libraryVariants.all { variant ->
    def task = variant.assembleProvider.get()
    task.doLast {
        // clear
        delete { delete magiskDir }

        // copy from template
        copy {
            from "$rootDir/template/magisk_module"
            into magiskDir.path
            exclude 'riru.sh'
        }
        // copy riru.sh
        copy {
            from "$rootDir/template/magisk_module"
            into magiskDir.path
            include 'riru.sh'
            filter { line ->
                line.replaceAll('%%%RIRU_MODULE_ID%%%', moduleId)
                        .replaceAll('%%%RIRU_MIN_API_VERSION%%%', moduleMinRiruApiVersion.toString())
                        .replaceAll('%%%RIRU_MIN_VERSION_NAME%%%', moduleMinRiruVersionName)
            }
            filter(FixCrLfFilter.class,
                    eol: FixCrLfFilter.CrLf.newInstance("lf"))
        }
        // copy .git files manually since gradle exclude it by default
        Files.copy(file("$rootDir/template/magisk_module/.gitattributes").toPath(), file("${magiskDir.path}/.gitattributes").toPath())

        // generate module.prop
        def modulePropText = ""
        magiskModuleProp.each { k, v -> modulePropText += "$k=$v\n" }
        modulePropText = modulePropText.trim()
        file("$magiskDir/module.prop").text = modulePropText

        // generate module.prop for Riru
        def riruModulePropText = ""
        moduleProp.each { k, v -> riruModulePropText += "$k=$v\n" }
        riruModulePropText = riruModulePropText.trim()
        file(riruDir).mkdirs()

        // module.prop.new will be renamed to module.prop in post-fs-data.sh
        file("$riruDir/module.prop.new").text = riruModulePropText

        // copy native files
        def nativeOutDir = file("build/intermediates/cmake/$variant.name/obj")

        file("$magiskDir/system").mkdirs()
        file("$magiskDir/system_x86").mkdirs()
        renameOrFail(file("$nativeOutDir/arm64-v8a"), file("$magiskDir/system/lib64"))
        renameOrFail(file("$nativeOutDir/armeabi-v7a"), file("$magiskDir/system/lib"))
        renameOrFail(file("$nativeOutDir/x86_64"), file("$magiskDir/system_x86/lib64"))
        renameOrFail(file("$nativeOutDir/x86"), file("$magiskDir/system_x86/lib"))

        // generate sha1sum
        fileTree("$magiskDir").matching {
            exclude "README.md", "META-INF"
        }.visit { f ->
            if (f.directory) return
            file(f.file.path + ".sha256sum").text = calcSha256(f.file)
        }
    }
    task.finalizedBy zipMagiskMoudle
}

task zipMagiskMoudle(type: Zip) {
    from magiskDir
    archiveName zipName
    destinationDir outDir
}

```

# 模块加载过程
一个典型的riru插件的加载顺序可以简单理解为:

update_binary -> customize.sh -> post-fs-data.sh 

其中customize.sh是riru重写update_binary进行执行的，其他都是遵循magisk的插件执行顺序。

接下来就通过这些shell脚本的执行来找到riru是如何定位插件、解析插件、执行插件和完成zygote注入的。

首先看riru是如何被magisk执行的，因为riru也是一个magisk插件，所以直接先看post-fs-data.sh，可以看到:
```
LIBRARIES_FILE='/system/etc/public.libraries.txt'
mkdir -p "$MODDIR/system/etc"
cp -f $LIBRARIES_FILE "$MODDIR/$LIBRARIES_FILE"
grep -qxF 'libriru.so' "$MODDIR/$LIBRARIES_FILE" || echo 'libriru.so' >> "$MODDIR/$LIBRARIES_FILE"
```

这个版本的riru直接通过/system/etc/public.libraries.txt自动完成so的dlopen加载。

```
PS：

riru目前存在了三种已知的app_process注入实现：
1. 最早通过替换libmemtrack.so
2. 后来通过/system/etc/public.libraries.txt
3. 目前通过native bridge即设置系统属性ro.dalvik.vm.native.bridge

```

因此可以直接奔向riru的so，找到.init_array方法（\_\_attribute\_\_((constructor))），可以看到两个关键方法调用，分别为

> XHOOK_REGISTER(".*\\libandroid_runtime.so$", jniRegisterNativeMethods);

和

> load_modules();

具体.init_array代码可以看main.cpp中：
```

extern "C" void constructor() __attribute__((constructor));

// _init_array libriru.so被dlopen后最先执行的函数
void constructor() {
#ifdef DEBUG_APP
    hide::hide_modules(nullptr, 0);
#endif

    if (getuid() != 0)
        return;

    char cmdline[ARG_MAX + 1];
    get_self_cmdline(cmdline, 0);

    if (strcmp(cmdline, "zygote") != 0
        && strcmp(cmdline, "zygote32") != 0
        && strcmp(cmdline, "zygote64") != 0
        && strcmp(cmdline, "usap32") != 0
        && strcmp(cmdline, "usap64") != 0) {
        LOGW("not zygote (cmdline=%s)", cmdline);
        return;
    }

    LOGI("Riru %s (%d) in %s", RIRU_VERSION_NAME, RIRU_VERSION_CODE, cmdline);

    LOGI("config dir is %s", CONFIG_DIR);

    if (access(CONFIG_DIR "/disable", F_OK) == 0) {
        LOGI("%s exists, do nothing", CONFIG_DIR "/disable");
        return;
    }

    read_prop();

    // 通过GOT表hook libandroid_runtime.so中对jniRegisterNativeMethods方法的调用，因为libandroid_runtime.so中所有JNI方法都是通过该方法进行注册，然后再通过手动调用registeNatives来替换
    // 因此通过hook该方法可以在com.android.internal.os.Zygote#nativeForkAndSpecialize和com.android.internal.os.Zygote#nativeForkSystemServer注册时进行替换
    // Riru也因此完成了zygote进程的注入
    XHOOK_REGISTER(".*\\libandroid_runtime.so$", jniRegisterNativeMethods);
    
    if (xhook_refresh(0) == 0) {
        xhook_clear();
        LOGI("hook installed");
    } else {
        LOGE("failed to refresh hook");
    }

    // 加载插件
    load_modules();

    status::writeToFile();
}
```

## XHOOK_REGISTER
这里XHOOK_REGISTER是一个宏定义，
> XHOOK_REGISTER(".*\\libandroid_runtime.so$", jniRegisterNativeMethods);

实际上相当于

```

    if (xhook_register(".*\\libandroid_runtime.so$", jniRegisterNativeMethods, (void*) new_jniRegisterNativeMethods, (void **) &old_jniRegisterNativeMethods) != 0) \
        LOGE("failed to register hook jniRegisterNativeMethods ."); \

```
new_jniRegisterNativeMethods和old_jniRegisterNativeMethods则是通过NEW_FUNC_DEF宏定义来进行声明：
```
#define NEW_FUNC_DEF(ret, func, ...) \
    static ret (*old_##func)(__VA_ARGS__); \
    static ret new_##func(__VA_ARGS__)

NEW_FUNC_DEF(int, jniRegisterNativeMethods, JNIEnv *env, const char *className,
             const JNINativeMethod *methods, int numMethods) {
    api::putNativeMethod(className, methods, numMethods);

    LOGD("jniRegisterNativeMethods %s", className);

    JNINativeMethod *newMethods = nullptr;
    if (strcmp("com/android/internal/os/Zygote", className) == 0) {
        // com/android/internal/os/Zygote注册时回调onRegisterZygote方法获取新的jniMethods列表进行替换
        newMethods = onRegisterZygote(env, className, methods, numMethods);
    } else if (strcmp("android/os/SystemProperties", className) == 0) {
        // hook android.os.SystemProperties#native_set to prevent a critical problem on Android 9
        // see comment of SystemProperties_set in jni_native_method.cpp for detail
        // 回调onRegisterSystemProperties方法
        newMethods = onRegisterSystemProperties(env, className, methods, numMethods);
    }

    int res = old_jniRegisterNativeMethods(env, className, newMethods ? newMethods : methods,
                                           numMethods);
    /*if (!newMethods) {
        NativeMethod::jniRegisterNativeMethodsPost(env, className, methods, numMethods);
    }*/
    delete newMethods;
    return res;
}
```

可以看到在com/android/internal/os/Zygote注册JNI方法时会回调onRegisterZygote方法获取新的jniMethods列表进行替换，在onRegisterZygote方法中主要替换了三个方法的fnPtr指针并兼容不同的安卓版本：
- nativeForkAndSpecialize
- nativeSpecializeAppProcess
- nativeForkSystemServer

这三个方法是应用进程或者系统服务进程被fork 出来的时候会调用的方法，这里以nativeForkAndSpecialize举例分析nativeForkAndSpecialize的AOP逻辑和模块中声明的forkAndSpecializePre/Post等系列方法如何被调用及调用时机。
```
jint nativeForkAndSpecialize_r(
        JNIEnv *env, jclass clazz, jint uid, jint gid, jintArray gids, jint runtime_flags,
        jobjectArray rlimits, jint mount_external, jstring se_info, jstring se_name,
        jintArray fdsToClose, jintArray fdsToIgnore, jboolean is_child_zygote,
        jstring instructionSet, jstring appDataDir, jboolean isTopApp, jobjectArray pkgDataInfoList,
        jobjectArray whitelistedDataInfoList, jboolean bindMountAppDataDirs, jboolean bindMountAppStorageDirs) {

    // 通过nativeForkAndSpecialize_pre和nativeForkAndSpecialize_post完成了nativeForkAndSpecialize方法的AOP
    nativeForkAndSpecialize_pre(env, clazz, uid, gid, gids, runtime_flags, rlimits, mount_external,
                                se_info, se_name, fdsToClose, fdsToIgnore, is_child_zygote,
                                instructionSet, appDataDir, isTopApp, pkgDataInfoList, whitelistedDataInfoList,
                                bindMountAppDataDirs, bindMountAppStorageDirs);

    jint res = ((nativeForkAndSpecialize_r_t *) JNI::Zygote::nativeForkAndSpecialize->fnPtr)(
            env, clazz, uid, gid, gids, runtime_flags, rlimits, mount_external, se_info, se_name,
            fdsToClose, fdsToIgnore, is_child_zygote, instructionSet, appDataDir, isTopApp, pkgDataInfoList,
            whitelistedDataInfoList, bindMountAppDataDirs, bindMountAppStorageDirs);

    nativeForkAndSpecialize_post(env, clazz, uid, res);
    return res;
}

static void nativeForkAndSpecialize_pre(
        JNIEnv *env, jclass clazz, jint &uid, jint &gid, jintArray &gids, jint &runtime_flags,
        jobjectArray &rlimits, jint &mount_external, jstring &se_info, jstring &se_name,
        jintArray &fdsToClose, jintArray &fdsToIgnore, jboolean &is_child_zygote,
        jstring &instructionSet, jstring &appDataDir, jboolean &isTopApp, jobjectArray &pkgDataInfoList,
        jobjectArray &whitelistedDataInfoList, jboolean &bindMountAppDataDirs, jboolean &bindMountAppStorageDirs) {

    // 遍历执行每个模块的forkAndSpecializePre方法，这里可以知道，只需要在模块中声明forkAndSpecializePre方法，即可在com.android.internal.os.Zygote#forkAndSpecialize方法执行前被调用
    for (auto module : *get_modules()) {
        if (!module->hasForkAndSpecializePre())
            continue;

        if (module->hasShouldSkipUid() && module->shouldSkipUid(uid))
            continue;

        if (!module->hasShouldSkipUid() && shouldSkipUid(uid))
            continue;

        module->forkAndSpecializePre(
                env, clazz, &uid, &gid, &gids, &runtime_flags, &rlimits, &mount_external,
                &se_info, &se_name, &fdsToClose, &fdsToIgnore, &is_child_zygote,
                &instructionSet, &appDataDir, &isTopApp, &pkgDataInfoList, &whitelistedDataInfoList,
                &bindMountAppDataDirs, &bindMountAppStorageDirs);
    }
}
```

## load_modules

load_modules解析如下：

```
void load_modules() {
    DIR *dir;
    struct dirent *entry;
    char path[PATH_MAX];
    void *handle;
    const int riruApiVersion = RIRU_API_VERSION;

    if (!(dir = _opendir(MODULES_DIR))) return;

    // 遍历/data/adb/riru/modules目录下的文件夹
    while ((entry = _readdir(dir))) {
        if (entry->d_type != DT_DIR) continue;

        // 获取文件夹名称
        auto name = entry->d_name;
        if (name[0] == '.') continue;

        // 根据文件夹名称拼接so路径：/system/lib/libriru_%s.so，这一步操作也是在riru插件的customize.sh中完成
        snprintf(path, PATH_MAX, MODULE_PATH_FMT, name);

        if (access(path, F_OK) != 0) {
            PLOGE("access %s", path);
            continue;
        }

        handle = dlopen(path, 0);
        if (!handle) {
            LOGE("dlopen %s failed: %s", path, dlerror());
            continue;
        }

        // 找到so的init方法，这里也是为什么riru的官方文档中指出必须要有一个导出的init函数
        // 如果没有init方法，则将不会被认为是一个合法的riru module，后续get_modules也无法获取到
        auto init = (RiruInit_t *) dlsym(handle, "init");
        if (!init) {
            LOGW("%s does not export init", path);
            cleanup(handle, path);
            continue;
        }

        // 1. pass riru api version, return module's api version
        auto apiVersion = (int *) init((void *) &riruApiVersion);
        if (apiVersion == nullptr) {
            LOGE("%s returns null on step 1", path);
            cleanup(handle, path);
            continue;
        }

        if (*apiVersion < RIRU_MIN_API_VERSION || *apiVersion > RIRU_API_VERSION) {
            LOGW("unsupported API %s: %d", name, *apiVersion);
            cleanup(handle, path);
            continue;
        }

        // 2. create and pass Riru struct by module's api version
        auto module = new RiruModule(strdup(name));
        module->handle = handle;
        module->apiVersion = *apiVersion;

        if (*apiVersion == 9) {
            auto info = init_module_v9(module->token, init);
            if (info == nullptr) {
                LOGE("%s returns null on step 2", path);
                cleanup(handle, path);
                continue;
            }
            module->info(info);
        }

        // 3. let the module to do some cleanup jobs
        init(nullptr);

        // 缓存插件信息到一个vector中，后续通过get_modules()方法才能找到对应的插件信息
        get_modules()->push_back(module);

        LOGI("module loaded: %s (api %d)", module->name, module->apiVersion);
    }

    closedir(dir);

    status::getStatus()->hideEnabled = access(ENABLE_HIDE_FILE, F_OK) == 0;
    if (status::getStatus()->hideEnabled) {
        LOGI("hide is enabled");
        auto modules = get_modules();
        auto names = (const char **) malloc(sizeof(char *) * modules->size());
        int names_count = 0;
        for (auto module : *get_modules()) {
            if (strcmp(module->name, MODULE_NAME_CORE) == 0) continue;
            if (!module->supportHide) {
                LOGI("module %s does not support hide", module->name);
                continue;
            }
            names[names_count] = module->name;
            names_count += 1;
        }
        hide::hide_modules(names, names_count);
    } else {
        PLOGE("access " ENABLE_HIDE_FILE);
        LOGI("hide is not enabled");
    }

    for (auto module : *get_modules()) {
        if (module->hasOnModuleLoaded()) {
            LOGV("%s: onModuleLoaded", module->name);
            // 回调module的_onModuleLoaded方法
            module->onModuleLoaded();
        }
    }
}
```

# EdXposed如何依赖riru
EdXposed本身也是一个riru插件，但是如何证明呢。

我们可以知道如果作为一个riru插件，必然需要
1. 在/data/adb/riru/modules或者/data/misc/riru/modules下存在一个插件文件夹。
2. 存在与插件文件夹相同名称的/system/lib/libriru_%s.so
3. so中可能有init或者forkAndSpecializePre等zygote进程相关的方法

在edxp-core中，依然通过build.gradle为入口分析zip打包的逻辑，可以看到也是一个标准的magisk module installer，其中customize.sh中有一行关键代码创建了riru插件的相关目录：

```

# 创建riru的module目录，这里可以看出edxp同时是一个riru module，riru通过检测目录加载对应的libriru_xxx.so
[[ -d "${RIRU_TARGET}" ]] || mkdir -p "${RIRU_TARGET}" || abort "! Can't mkdir -p ${RIRU_TARGET}"

# RIRU_TARGET变量的赋值过程
RIRU_PATH="/data/misc/riru"
# 为libriru_edxp.so设置随机后缀, libriru_edxp.so -> libriru_{randomNum}.so
# libriru_edxp.so由edxp-core:src/main/cpp/main相关c文件编译得出
# getRandomNameExist方法作用为获取一个/proc/sys/kernel/random/uuid不存在的四位随机数
RIRU_EDXP="$(getRandomNameExist 4 "libriru_" ".so" "
/system/lib
/system/lib64
")"
RIRU_MODULES="${RIRU_PATH}/modules"
RIRU_TARGET="${RIRU_MODULES}/${RIRU_EDXP}"

```

通过这段脚本可以看出edxp插件在magisk加载时创建了一个riru插件目录，并且把libriru_edxp.so重命名成一个随机后缀的so文件由riru进行加载。

接着分析libriru_edxp.so，通过CMakeLists.txt可以知道是由edxp-core中编译得到，查看edxp-core/src/main/cpp/main/src/main.cpp中可以看到确实声明了riru中的一些方法模版钩子：
- nativeForkAndSpecializePre
- nativeForkAndSpecializePost
- nativeForkSystemServerPre
- nativeForkSystemServerPost
- specializeAppProcessPre
- specializeAppProcessPost
- onModuleLoaded
- shouldSkipUid


等方法，一切都可以想明白了。接下来就是edxp如何进行ART Hook。


# PS
0. [riru-docs](https://github.com/AlienwareHe/riru-docs) :https://github.com/AlienwareHe/riru-docs
1. 目前的riru v22中可以看到一个riru module必须包含一个init导出函数，但是在edxp里并没有发现有init函数，在v19的riru中是没有init函数限制，而是校验module.prop。
2. riru v22中提到切换到native bridge方式注入之后，会导致riru和模块的加载时机变晚，对于Xposed框架可能会有变化和影响。

```
Starting v22.0, Riru has switched to "native bridge" (ro.dalvik.vm.native.bridge) to inject zygote, this will lead Riru and modules be loaded later (LoadNativeBridge vs __attribute__((constructor))).

For most modules, this should have no problem, but modules like Xposed frameworks may have to make changes.

Magisk may provider Riru-like features in the far future, and of course, it will have more strict restrictions, module codes will not be run in zygote. Maybe Xposed framework modules should prepare for this?
```