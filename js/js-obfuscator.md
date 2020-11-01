可能用到的网址：
* https://astexplorer.net/
* https://bbs.nightteam.cn/thread-423.htm


JS**常规**混淆可归结为三类：
1. eval类型
2. hash类型（JSA，[javascript-obfuscator](https://github.com/javascript-obfuscator/javascript-obfuscator)等）
3. 压缩类型（uglify等）


# JSA加密
```
加密前：
function logG(message) {
  console.log('\x1b[32m%s\x1b[0m', message); 
}

logG('logR');

加密后：
function o00($) {
  console.log("\x1b[32m%s\x1b[0m", $)
}

o00("logR");
```

# javascript-obfuscator反混淆
常规的JS混淆都没有太大的杀伤力，真正令人头秃的往往是AST混淆，例如可以在[Js Ob混淆](https://www.sojson.com/js.html)上体验一下混淆前和混淆后的对比。

该混淆主要包括了以下几个功能，真正核心的控制流平坦化，通过平坦化将原有JS中的各个部分代码打乱，然后通过swtich case块进行分发和执行顺序的控制，将原有的顺序可见的代码变为无逻辑的各个分发块和真实块的组合。
* JS压缩 
* 变量重命名
* 字符串提取及加密 
* 无用控制流注入
* 控制流平坦化
* 代码转换
* DEBUG保护
* 禁止控制台输出
* 域名锁定

```
最基础的ob混淆：
var _0xd6ac = ['[41m%s[0m', 'logG', 'log'];
(function(_0x203a66, _0x6dd4f4) {
  var _0x3c5c81 = function(_0x4f427c) {
    while (--_0x4f427c) {
      _0x203a66['push'](_0x203a66['shift']());
    }
  };
  _0x3c5c81(++_0x6dd4f4);
}(_0xd6ac, 0x6e));
var _0x5b26 = function(_0x2d8f05, _0x4b81bb) {
  _0x2d8f05 = _0x2d8f05 - 0x0;
  var _0x4d74cb = _0xd6ac[_0x2d8f05];
  return _0x4d74cb;
};

function logG(_0x4f1daa) {
  console[_0x5b26('0x0')]('[32m%s[0m', _0x4f1daa);
}

logR(_0x5b26('0x2'));
```

## 什么是AST

一门高级语言变成CPU能够执行的机器码指令，会经过词法分析 、语法分析、中间代码生成、中间代码优化、目标代码生成、机器代码优化等步骤。其中将中间代码生成及之前 阶段划分为编译器的前端，之后分为后端，那么可以保证 前端与后端的独立性。

以下内容参考于：
https://github.com/yacan8/blog/blob/master/posts/JavaScript%E6%8A%BD%E8%B1%A1%E8%AF%AD%E6%B3%95%E6%A0%91AST.md

在JS中，通常把JS源码转化为**AST（抽象语法树）**成为解析部分，这个步骤分为词法分析和语法分析。

词法分析主要是对源代码文件中的字符进行切割（分词），分成一个个符号并生成符号标记树。语法分析是对符号标记树中的标记进一步分析语法，并生成语法树，语义分析是对源代码上下文的整体检查，最后根据生成的正确语法树翻译成中间代码。

## 如何进行AST还原

这里找了一个非常详细的帖子介绍了如何进行AST还原实战，看了这篇帖子完全足以应对简单的AST，更多关于AST反混淆的可以关注蔡老板的菜鸟学Python编程公众号～

> https://bbs.nightteam.cn/thread-423.htm

### 1.unicode或16进制的字符串混淆如何还原
可以看AST中对应Node的Type为StringLiteral/NumericLiteral的value属性中 都是真实值，extra属性中是被混淆后的值，所以可以直接将type的extra属性删掉。

### 2.像 _0x19882c['removeCookie']\['toString'\]() 如何转换成 _0x19882c.removeCookie.toString()
继续查看AST中对应的Node，可以发现有一个computed属性被设置成了true，当我们该属性改为false即可。

### 3.自调用函数如何简化
自调用函数的AST节点规律，ExpresionSatetment && path.node.type = CallExpression && path.node.expression.callee == FunctionExpression && 方法参数长度为0

### 4.控制流平坦化如何还原
1. 观察switch分发器特征，及分发后的case代码块
2. 确认了分发规则后，进行AST建模
3. 模拟分发规则，将每个Statement组合 到新数组中
4. 替换原while节点