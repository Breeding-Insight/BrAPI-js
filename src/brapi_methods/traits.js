// GET /traits & GET /traits/{traitDbId}
export function traits(params,behavior){
    var behavior = behavior=="map"?behavior:"fork";
    return this.brapi_call(behavior,"get",function(datum){
        var datum_params = typeof params === "function" ? params(datum) 
                            : Object.assign({}, params);
        var url = "/traits";
        if(datum_params.traitDbId!=undefined){
            url+="/"+datum_params.traitDbId;
            delete datum_params.traitDbId;
        }
        return {'url':url, 'params':datum_params};
    }, typeof params === "function");
}
