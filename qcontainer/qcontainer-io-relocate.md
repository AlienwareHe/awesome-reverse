为了实现应用分身，可以理解为一机多号的功能，即在一个设备上虚拟出多个APP运行环境，如果了解安卓开发，可以知道安卓中每个app都有自己的沙盒目录/data/data/package-name，该目录下仅有该APP有权限访问，APP产生的一些持久化或缓存文件也会存放至该目录或者SD卡中。

因此如果我们配合指纹模拟，并且在APP启动时将应用的沙盒目录给隔离和虚拟化，那么每次APP启动时都相当于在一个全新的设备上启动。所以，QC实现应用分身的基础在于IO重定向技术。

IO重定向技术来源于VirtualApp，原理仍然是通过hook实现，只不过是hook了libc中所有关于IO的底层函数，例如fopen某个文件时通过hook将参数修改为重定向后的路径。libc是安卓中基础的C函数库，大部分关于IO的API底层都是使用的该库中的函数。

QContainer中为了实现应用分身，重定向了下述几个目录：
- /data/data/package-name -> /data/data/package-name/virtual_devices/userId/data
- /data/user/0/package-name -> /data/data/package-name/virtual_devices/userId/data
- /data/user_de/0/ -> /data/data/package-name/virtual_devices/userId/user_de
- /tmp/ -> /data/data/package-name/virtual_devices/userId/temp
- /sdcard -> /data/data/package-name/virtual_devices/userId/sdcard
- /storage/emulated/0 -> /data/data/package-name/virtual_devices/userId/sdcard

可以看出对SD卡也进行了重定向和隔离，为了保证能够在设备应用期间通过文件与Slave或其他设备进行通信，特意对/sdcard/ratel_white_dir/package-name路径设置了白名单，该目录下的文件将不会被重定向到应用虚拟目录下，在代码中可以通过CamelToolKit.whiteSdcardPath引用该路径。

除此之外，在模拟设备指纹时，也对相关系统内核文件进行了重定向。

同时为了防止虚拟目录泄漏，还对/data/data/package-name/virtual_devices/虚拟目录进行了隐藏。

## IO重定向API使用
IO重定向Java层的JNI入口为com.camel.runtime.NativeEngine，Native层入口为IOUniformer.cpp。

在NativeEngine中，与IO重定向相关的API有：
- enableIORedirect 启用IO重定向，调用该方法后，才会执行IO重定向相关的Hook
- forbid(String) 隐藏某路径文件
- whitelist(String) 设置IO白名单，如果是目录，则以/结尾
- redirectFile(String,String) 重定向文件
- redirectDirectory(String,String) 重定向目录
- getRedirectedPath(String) 获取路径重定向后的路径，若未被重定向，则返回原路径
- reverseRedirectedPath(String) 获取路径重定向前的路径