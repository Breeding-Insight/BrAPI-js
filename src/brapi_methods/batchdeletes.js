/** `GET /batchDeletes/{batchDeleteDbId}`
 * @alias BrAPINode.prototype.batchDeletes
 * @param {Object} params Parameters to provide to the call
 * @param {String} [behavior="fork"] Behavior of the node
 * @return {BrAPI_Behavior_Node}
 */
export function batchdeletes_detail (params,behavior){
    var call = {
        'defaultMethod': 'get',
        'urlTemplate': '/batchDeletes/{batchDeleteDbId}',
        'params': params,
        'behaviorOptions': ['fork','map'],
        'behavior': behavior,
    }
    this.version.check(call.urlTemplate,{
        introduced:"v2.1"
    });
    return this.simple_brapi_call(call);
}

/** `PUT /batchDeletes/{batchDeleteDbId} `
 * @alias BrAPINode.prototype.batchDeletes_modify
 * @param {Object} params Parameters to provide to the call
 * @param {String} [behavior="fork"] Behavior of the node
 * @return {BrAPI_Behavior_Node}
 */
export function batchdeletes_modify (params,behavior){
    var call = {
        'defaultMethod': 'put',
        'urlTemplate': '/batchDeletes/{batchDeleteDbId}',
        'params': params,
        'behaviorOptions': ['fork','map'],
        'behavior': behavior,
    }
    this.version.check(call.urlTemplate,{
        introduced:"v2.1"
    });
    return this.simple_brapi_call(call);
}

/** `POST /batchDeletes`
 * @alias BrAPINode.prototype.batchdeletes_store
 * @param {Object} params Parameters to provide to the call
 * @param {String} [behavior="fork"] Behavior of the node
 * @return {BrAPI_Behavior_Node}
 */
export function batchdeletes_store (params,behavior){
    var call = {
        'defaultMethod': 'post',
        'urlTemplate': '/batchDeletes',
        'params': params,
        'behaviorOptions': ['fork','map'],
        'behavior': behavior,
    }
    this.version.check(call.urlTemplate,{
        introduced:"v2.1"
    });
    return this.simple_brapi_call(call);
}

/** `DELETE /batchDeletes/{batchDeleteDbId}?hardDelete=true`
 * @alias BrAPINode.prototype.batchdeletes_delete
 * @param {Object} params Parameters to provide to the call
 * @param {String} params.batchDeleteDbId batchDeleteDbId
 * @param {hardDelete} params.hardDelete=true whether is a hard or soft delete
 * @return {BrAPI_Behavior_Node}
 */
export function batchdeletes_delete(params){
    var call = {
        'defaultMethod': 'delete',
        'urlTemplate': '/batchDeletes/{batchDeleteDbId}?hardDelete=true',
        'params': params,
        'behavior': 'map',
    }
    this.version.check(call.urlTemplate,{
        introduced:"v2.1"
    });
    return this.simple_brapi_call(call);
};