if (typeof (window) == "undefined") {
    var codeHandler = (function(){
        var base64Chars = [
                'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H',
                'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P',
                'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X',
                'Y', 'Z', 'a', 'b', 'c', 'd', 'e', 'f',
                'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n',
                'o', 'p', 'q', 'r', 's', 't', 'u', 'v',
                'w', 'x', 'y', 'z', '0', '1', '2', '3',
                '4', '5', '6', '7', '8', '9', '+', '/'
            ],
            encode = {
                'base64':codeBase64
            },
            decode = {
                'base64':decodeBase64
            }
        handleFormat = {
            'utf-8':toUTF8Binary
        };
        function stringToBinary(str , size , encodeType ){
            //  str-字符串 , size - 转换后的二进制位数 ,encodeType - 采用什么格式去保存二进制编码
            var i,
                len,
                binary = '';
            for ( i = 0 , len = str.length ; i < len ; i++ ){
                binary = binary + handleFormat[encodeType.toLowerCase()](str.charCodeAt(i));
            }
            return binary;
        }
        // 转换为以UTF-8格式的二进制数据
        function toUTF8Binary(unicode){
            var len,
                binary = '',
                star = 0,
                bitStream = unicode.toString(2), // 转换为二进制比特流
                bitLen = bitStream.length,
                i;
            if( unicode >= 0x000000 && unicode <= 0x00007F ){
                binary = bitStream;
                for( i = 0 , len = 8 ; i　< len-bitLen ; i ++ ){
                    binary = 0 +binary; // 不足8位补0
                }
            }else if( unicode >=0x000080 && unicode <=0x0007FF ){
                binary = bitStream;
                for( i = 0 , len = 11 ; i　< len-bitLen ; i ++ ){
                    binary = 0 +binary; // 不足11位补0
                }
                binary = '110'+binary.substr(0,5) + '10' + binary.substr(5,6);
            }
            else if( unicode >=0x000800 && unicode <=0x00FFFF ){
                binary = bitStream;
                for( i = 0 , len = 16 ; i　< len-bitLen ; i ++ ){
                    binary = 0 +binary; // 不足16位补0
                };
                binary = '1110' +
                    binary.substr(0,4) +
                    '10' +
                    binary.substr(4,6) +
                    '10' +
                    binary.substr(10,6);
            }
            else if( unicode >=0x010000 && unicode <=0x10FFFF ){
                binary = bitStream;
                for( i = 0 , len = 21 ; i　< len-bitLen ; i ++ ){
                    binary = 0 +binary; // 不足21位补0
                }
                binary = '11110' +
                    binary.substr(0,3) +
                    '10' +
                    binary.substr(3,6) +
                    '10' +
                    binary.substr(9,6) +
                    '10' +
                    binary.substr(15,6);
            }
            return binary;
        }
        // 编码成base64格式
        function base64Parse(binary24,flag){
            var i,
                len,
                result = '',
                decode;
            if(flag == 1){
                for( i = 0 ; i < 4 ; i++){
                    decode = parseInt(binary24.substr(i*6,6),2);
                    result = result + base64Chars[decode];
                }
            }
            else{
                for ( i=0 , len = Math.floor(flag/6) ;i<len+1; i++){
                    decode = parseInt(binary24.substr(i*6,6),2);
                    result = result + base64Chars[decode];
                }
                for( i = 0; i < 3-len ;i ++){
                    result = result + '=';
                }
            }
            return result;
        }
        // 解析为base64格式的二进制数据
        function codeBase64(str){
            var i,
                len,
                rem,
                mer,
                result = '',
                strBinaryAry = [],
                binary = stringToBinary(str , 8 , 'utf-8'); // base64是基于utf-8格式保存的二进制数据转换的
            len = binary.length;
            mer = Math.floor(len / 24);
            rem = len % 24;
            for( i = 0 ; i < mer ; i++){
                result = result +  base64Parse(binary.substr(i*24,24),1);
            }
            remCode = binary.substr(len-rem,rem);
            if( rem > 0 ){
                for( i =0 ; i < 24-rem ; i++){
                    remCode = remCode + 0;
                }
                result = result +  base64Parse(remCode,rem)
            }
            return result;

        }
        // 解码base64格式的数据
        function decodeBase64(str){
            var i,
                j,
                k,
                len,
                t = 0,
                curbinary,
                start  = 0 ,
                flag = [
                    {
                        str:'0',
                        len:8
                    },
                    {
                        str:'110',
                        len:11
                    },
                    {
                        str:'1110',
                        len:16
                    },
                    {
                        str:'11110',
                        len:21
                    }],
                binary= '',
                newStr = '';
            for( i = 0 , len = str.length ; i < len ; i++){
                var curbinary  = base64Chars.indexOf(str.charAt(i)).toString(2);
                if( curbinary != '-1'){

                    for( j = 0 ; curbinary.length <6 ; j++){
                        curbinary = 0 + curbinary;
                    }
                    binary = binary + curbinary;
                }
                if( i >= len-2 && str.charAt(i) == '='){
                    ++t;
                }
            }
            if( t == 0 ){
                len = binary.length;
            }
            else{
                len = binary.length - (6-2*t)
            }

            for( ; start < len ;){
                for( j  = 0 ; j < 4 ; j++){

                    if(binary.indexOf( flag[j].str ,start) == start){
                        if(flag[j].len == 8){
                            newStr = newStr +
                                String.fromCharCode(parseInt(binary.substr(start,8),2));
                        }
                        else if(flag[j].len == 11){
                            newStr = newStr +
                                String.fromCharCode(parsetInt(binary.substr(start+3,5) +
                                    binary.substr(start+10,6),2));
                        }
                        else if(flag[j].len == 16){
                            newStr = newStr +
                                String.fromCharCode(parsetInt(binary.substr(start+4,4) +
                                    binary.substr(start+10,6) +
                                    binary.substr(start+18,6),2));
                        }
                        else if(flag[j].len == 21){
                            newStr = newStr +
                                String.fromCharCode(parseInt(binary.substr(start+5,3) +
                                    binary.substr(start+10,6) + binary.substr(start+18,6) +
                                    binary.substr(start+26,6),2));
                        }
                        start  =  start  + flag[j].len;
                        break;
                    }
                }
            }
            binary = null;
            return newStr;
        }
        return {
            encode:function(str ,type){
                return encode[type](str);
            },
            decode:function(str, type){
                return decode[type](str);
            }
        };
    })();
    // 生成随机字符串
    function randomString(length) {
        var result = '';
        var chars = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
        for (var i = length; i > 0; --i) {
            result += chars[Math.floor(Math.random() * chars.length)];
        }
        return result;
    }

    var canvasBaseData = randomString(36) + "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";

    // mock document canvas绘制
    function CanvasElement() {
        this.attr = {};
        this.nodeName = "CANVAS";
        this.baseURI = "https://xiaomi.com";
        this.localName = "canvas";
        this.contentEditable = "inherit";
        this.setAttribute = function (name, value) {
            this.attr[name] = value;
        };
        this.getContext = function () {
            return {
                canvas: this,
                save: function () {

                },

                rect: function (a, b, c, d) {

                },

                isPointInPath: function (a, b, c) {
                    return false;
                },

                createLinearGradient: function (a, b, c, d) {
                    return {
                        addColorStop: function (a, b) {
                        }
                    }
                },
                restore: function () {
                },
                translate: function (a, b) {
                },
                beginPath: function (a, b) {
                },
                closePath: function () {
                },
                arc: function (a, b, c, d, e) {
                },
                fill: function () {
                },
                fillText: function () {
                },
                stroke: function () {
                },
                fillRect: function () {
                },
                fillStyle: "#000000"
            }
        };
        this.toDataURL = function (type, quality) {
            try {
                if (typeof (quality) === "undefined") {
                    quality = 0.92;
                }
                var attrs = JSON.stringify(this.attr);
                // 同一type不同quality返回url不同
                var finalData = codeHandler.encode(Math.floor(quality * 100) + attrs + canvasBaseData,'base64')
                if (type === 'image/jpeg') {
                    return "data:image/jpeg;base64," + finalData;
                } else {
                    return "data:image/png;base64," + finalData;
                }
            } catch (e) {
                log(e.stack);
                return "asdfafd";
            }
        };
    }

    var document = {};

    document.createElement = function (item) {
        if (item === 'canvas') {
            return new CanvasElement()
        } else {
            return {
                attr: {},
                tagName: item.toUpperCase(),
                appendChild: function (element) {
                    return document.createElement(element);
                },
                getAttribute: function (name) {
                    return this.attr[name];
                },
                setAttribute: function (name, value) {
                    this.attr[name, value];
                },
                style: {
                    height: 20
                }
            }
        }
    };
    document.createElement.toString = function () {
        return "function createElement() { [native code] }";
    };
    document.body = null;
    document.visibilityState = "visible";
    document.documentElement = document.createElement('html');
    document.children = document.createElement('html');

    var navigator = {};
    navigator.connection = {effectiveType: "4g"}
    navigator.hardwareConcurrency = 12;
    navigator.language = "zh-CN";
    navigator.userAgent = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_14_3) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/83.0.4103.97 Safari/537.36";
    navigator.platform = "MacIntel";
    navigator.plugins = [];
    navigator.appCodeName = "Mozilla";
    navigator.appName = "Netscape";
    navigator.appVersion = "5.0 (Macintosh; Intel Mac OS X 10_14_3) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/83.0.4103.116 Safari/537.36";
    navigator.cookieEnabled = true;

    function plugin(name, filename, desc, suffixes, type) {
        if (name == 'Native Client') {
            return {
                0: {
                    description: desc,
                    enabledPlugin: {},
                    suffixes: suffixes,
                    type: type
                },
                1: {
                    description: 'Portable Native Client Executable',
                    enabledPlugin: {},
                    suffixes: '',
                    type: 'application/x-pnacl'
                },
                description: desc,
                filename: filename,
                name: name,
                length: 2
            }
        } else {
            return {
                0: {
                    description: desc,
                    enabledPlugin: {},
                    suffixes: suffixes,
                    type: type
                },
                description: desc,
                filename: filename,
                name: name,
                length: 1
            }
        }
    };

    var pluginArray = [
        new plugin('Chrome PDF Plugin', 'internal-pdf-viewer', 'Portable Document Format', 'pdf', 'application/x-google-chrome-pdf'),
        new plugin('Chrome PDF Viewer', 'mhjfbmdgcfjbbpaeojofohoefgiehjai', '', 'pdf', 'application/pdf'),
        new plugin('Native Client', 'internal-nacl-plugin', '', '', 'application/x-nacl')
    ];
    navigator.plugins = pluginArray;


    var location = {};
    location.href = "https://m.ctrip.com/webapp/ticket/dest/t1412255.html?host=you&ctm_ref=&popup=close";

    Window = function () {

    };
    Location = function () {
    };

    var window = new Window();

    window.Math = Math;

    window.self = window;
    window.top = window;
    // window.require = require;
    window.document = document;
    window.location = location;

    window.String = String;
    // 异常堆栈检测
    var _indexOf = String.prototype.indexOf;
    String.prototype.indexOf = function (searchValue, fromIndex) {
        if (searchValue == '/modules/cjs/loader') {
            return -1;
        }
        return _indexOf.apply(this, [searchValue, fromIndex]);
    };

    window.Object = Object;
    window.escape = escape;
    window.Date = Date;
    window.RegExp = RegExp;
    window.JSON = JSON;
    window.Function = Function;
    window.Navigator = function () {
        return navigator;
    };
    window.navigator = navigator;
    window.window = window;
    window.parseInt = parseInt;


    var originString = Function.prototype.toString;
    // native方法检测
    Function.prototype.toString = function () {
        if (this == Window || this == Location || this == Function.prototype.toString) {
            return "function Window() { [native code] }";
        }
        return originString.apply(this);
    };

    window.Window = Window;
    window.Location = Location;
    window.external = {};
    window.external.prototype = {
        toString: function () {
            return "[object External]";
        }
    }

    window.encodeURIComponent = encodeURIComponent
    window.Image = function () {
        return document.createElement('img');
    };
    window.valueOf = valueOf;
    window.toString = toString;

    // other info
    window.sessionStorage = {length: 0};
    window.localStorage = {length: 0};
    window.indexedDB = {length: 0};
    window.openDatabase = function () {
    };

    window.screen = {};
    window.screen.height = 1080;
    window.screen.width = 1920;
    window.screen.pixelDepth = 24;
    window.screen.colorDepth = 24;
    window.screen.availHeight = 1080;
    window.screen.availWidth = 1920;
    window.screen.orientation = {type: "landscape-primay"};

    Object.freeze(navigator);
}