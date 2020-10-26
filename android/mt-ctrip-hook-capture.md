## 1.抓包代码
```
XposedBridge.hookAllConstructors(XposedHelpers.findClass("com.sankuai.meituan.retrofit2.Response", SharedObject.loadPackageParam.classLoader), new XC_MethodHook() {
            @Override
            protected void afterHookedMethod(MethodHookParam param) throws Throwable {
                try {
                    Map<String, Object> request = Maps.newHashMap();
                    request.put("url", param.args[0]);
                    request.put("resp", param.args[4] == null ? "" : param.args[4].toString());
                    LogUtil.i("MEITUAN_HTTP", "#ClientCall Http Request#" + JSON.toJSONString(request));
                } catch (Exception e) {
                    Log.e("MEITUAN_HTTP", "#ClientCall Http Request# exception", e);
                }
            }
        });
```
## 2.OKHTTP降级开关
```
	public static com.sankuai.meituan.retrofit2.raw.RawCall.Factory a(java.lang.String str) {
        java.lang.Object[] objArr = {str};
        com.meituan.robust.ChangeQuickRedirect changeQuickRedirect = a;
        if (com.meituan.robust.PatchProxy.isSupport(objArr, null, changeQuickRedirect, true, "f3eb404c82ad0f34e256faed6da8654c", com.meituan.robust.utils.RobustBitConfig.DEFAULT_VALUE)) {
            return (com.sankuai.meituan.retrofit2.raw.RawCall.Factory) com.meituan.robust.PatchProxy.accessDispatch(objArr, null, changeQuickRedirect, true, "f3eb404c82ad0f34e256faed6da8654c");
        }
        if (str.equals("defaultokhttp")) {
            return (com.sankuai.meituan.retrofit2.raw.RawCall.Factory) b.c();
        }
        if (str.equals("okhttp")) {
            return (com.sankuai.meituan.retrofit2.raw.RawCall.Factory) c.c();
        }
        if (str.equals("nvnetwork")) {
            return (com.sankuai.meituan.retrofit2.raw.RawCall.Factory) d.c();
        }
        if (str.equals("oknv")) {
            return (com.sankuai.meituan.retrofit2.raw.RawCall.Factory) e.c();
        }
        if (str.equals("mapi")) {
            return (com.sankuai.meituan.retrofit2.raw.RawCall.Factory) f.c();
        }
        if (str.equals("statistics")) {
            return (com.sankuai.meituan.retrofit2.raw.RawCall.Factory) g.c();
        }
        throw new java.lang.IllegalArgumentException("key:" + str + "not supported");
    }
```

## 3.Ctrip Hook抓包
```
// 请求
RposedBridge.hookAllMethods(RposedHelpers.findClass("ctrip.business.comm.ProcoltolHandle",
                RatelToolKit.sContext.getClassLoader()),
                "buileRequest",
                new RC_MethodHook() {
                    @Override
                    protected void beforeHookedMethod(MethodHookParam methodHookParam) throws Throwable {
                        com.alibaba.fastjson.JSONObject jsonObject = null;
                        if (methodHookParam.args.length == 2) {
                            jsonObject = (com.alibaba.fastjson.JSONObject) JSON.toJSON(ForceFiledViewer.toView(methodHookParam.args[1]));
                        } else {
                            jsonObject = (com.alibaba.fastjson.JSONObject) JSON.toJSON(ForceFiledViewer.toView(methodHookParam.args[3]));
                        }
                        try {
                            String request = jsonObject.toJSONString();
                            String realServiceCode = JsonPath.read(request, "$.a.realServiceCode");
                            LogcatUtil.i(TAG, realServiceCode);
                            // 酒店列表页接口的serviceCode
                            if ("17100101".equals(realServiceCode)) {
                                String checkInDate = JsonPath.read(request, "$.a.searchSetting.checkInDate");
                                String checkOutDate = JsonPath.read(request, "$.a.searchSetting.checkOutDate");
                                String cityId = String.valueOf(JsonPath.read(request, "$.a.searchSetting.cityID"));
                                String pageIndex = String.valueOf(JsonPath.read(request, "$.a.sortingInfo.pageIndex"));
                                String log = String.format(HOTEL_LIST_REQUSET_LOG_TEMPLATE, pageIndex, cityId, checkInDate, checkOutDate);
                                Log.i(TAG, log);
                                saveToLog(log);
                            }
                        } catch (Throwable e) {
                            Log.e(TAG, "catch  http request error:", e);
                        }

                    }
                });

        //响应
        RposedHelpers.findAndHookMethod("ctrip.business.handle.Serialize",
                RatelToolKit.sContext.getClassLoader(),
                "readMessage",
                byte[].class,
                Class.class,
                new RC_MethodHook() {
                    @Override
                    protected void afterHookedMethod(MethodHookParam param) throws Throwable {
                        try {
                            Object resultObj = param.getResult();
                            String data = JSONObject.toJSONString(ForceFiledViewer.toView(resultObj));
                            String realServiceCode = JsonPath.read(data, "$.realServiceCode");

                            if (realServiceCode.equals("17100101")) {
                                // saveToLog(data);
                                List<String> hotelNames = JSONPATH.read(data);
                                if (hotelNames != null) {
                                    Log.i(TAG, JSON.toJSONString(hotelNames));
                                    saveToLog(JSON.toJSONString(hotelNames));
                                }
                            }
                        } catch (Throwable throwable) {
                            Log.e(TAG, "hook ctrip response error:", throwable);
                        }
                    }
                });

```