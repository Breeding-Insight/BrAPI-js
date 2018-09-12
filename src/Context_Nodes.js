import {Task,Join_Task} from './tasks'
import * as methods from './brapi_methods';
import brapiVersion from './brapiVersion.js';

var fetchRef;
if (typeof window === 'undefined') {
    fetchRef = require('node-fetch');
} else {
    fetchRef = window.fetch;
}

function parse_json_response(response) {
    return response.json();
}

export default class BrAPI_Methods {
    constructor(){}
}
for (var method_name in methods) {
    //apply each method to BrAPI_Methods, wrapping each in a version check
    let brapi_m = methods[method_name];
    brapi_m.introduced = brapi_m.introduced?brapiVersion(brapi_m.introduced):null;
    brapi_m.deprecated = brapi_m.deprecated?brapiVersion(brapi_m.deprecated):null;
    brapi_m.removed = brapi_m.removed?brapiVersion(brapi_m.removed):null;
    BrAPI_Methods.prototype[method_name] = function(){
        if (brapi_m.introduced && this.version.predates(brapi_m.introduced)){
            console.warn(method_name+" is unintroduced in BrAPI@"+this.version.string()+" before BrAPI@"+brapi_m.introduced.string());
        }
        else if (brapi_m.deprecated && !this.version.predates(brapi_m.deprecated)){
            console.warn(method_name+" is deprecated in BrAPI@"+this.version.string()+" since BrAPI@"+brapi_m.deprecated.string());
        }
        else if (brapi_m.removed && brapi_m.removed.predates(this.version)){
            console.warn(method_name+" was removed from BrAPI@"+this.version.string()+" since BrAPI@"+brapi_m.removed.string());
        }
        return brapi_m.apply(this,arguments);
    };
}

export class Context_Node extends BrAPI_Methods{
    constructor(parent_list,connection_information,node_type){
        super();
        this.isFinished = false;
        this.ranFinishHooks = false;
        this.node_type = node_type;
        this.parents = parent_list;
        this.async_hooks = [];
        this.catch_hooks = [];
        this.finish_hooks = [];
        this.task_map = {};
        this.connect = connection_information || {};
        this.version = this.connect.version;
    }
    
    addTask(task){
        this.task_map[task.getKey()] = task;
    }
    
    getTask(key){
        return this.task_map[key];
    }
    
    getTasks(){
        var self = this;
        return Object.keys(self.task_map).map(function(key) {
			return self.task_map[key];
    	});
    }
    
    publishResult(task){
        this.async_hooks.forEach(function(hook){
            hook(task.getResult(),task.getKey());
        });
        this.checkFinished(true);
    }
    
    addAsyncHook(hook){
        this.async_hooks.push(hook);
        this.getTasks().filter(function(task){
            return task.complete();
        }).forEach(function(task){
            hook(task.getResult(),task.getKey());
        });
    }
    
    addCatchHook(hook){
        this.catch_hooks.push(hook);
    }
    
    addFinishHook(hook){
        this.finish_hooks.push(hook);
        if(this.ranFinishHooks){
            hook(this.getTasks()
                .sort(function(a,b){
                    return a.key <= b.key ? -1 : 1;
                })
                .map(function(task){
                    return task.getResult();
                })
            );
        }
    }
    
    checkFinished(run_on_finish){
        if (!this.isFinished){
            var parsFin = this.parents.every(function(par){return par.checkFinished(false)});
            var thisFin = this.getTasks().every(function(task){return task.complete()});
            this.isFinished = parsFin && thisFin;
        }
        if (run_on_finish && !this.ranFinishHooks && this.isFinished){
            this.ranFinishHooks=true;
            this._onFinish();
        }
        return this.isFinished
    }
    
    _onFinish(){
        var self = this;
        this.finish_hooks.forEach(function(hook){
            hook(self.getTasks()
                .sort(function(a,b){
                    return a.key <= b.key ? -1 : 1;
                })
                .map(function(task){
                    return task.getResult();
                })
            );
        });
    }
    
    fail(reason){
        if (this.catch_hooks.length<1) throw reason;
        else {
            var self = this;
            this.catch_hooks.forEach(function(hook){
                hook(reason,self);
            });
        }
    }
    
    getTaskKeyOrigin(){
        if (this.parents.length<1 
                || this.node_type=="key"
                || this.node_type=="fork" 
                || this.node_type=="reduce"){
            return this;
        } else {
            return this.parents[0].getTaskKeyOrigin();
        }
    }
    
    each(func){ this.addAsyncHook(func); return this;}
    all(func){ this.addFinishHook(func); return this;}
    catch(func){ this.addCatchHook(func); return this;}
    
    keys(keyFunc){
        return new Key_Node(this,this.connect,keyFunc);
    }
    
    fork(forkFunc){
        return new Fork_Node(this,this.connect,forkFunc);
    }
    
    join(/*other,[other]...*/){
        var parent_nodes = [this];
        [].push.apply(parent_nodes,arguments);
        return new Join_Node(parent_nodes,this.connect);
    }
    
    reduce(reductionFunc,initialValue){
        return new Reduce_Node(this,this.connect,reductionFunc,initialValue);
    }
    
    map(mapFunc){
        return new Map_Node(this,this.connect,mapFunc);
    }
    
    filter(filterFunc){
        return new Filter_Node(this,this.connect,filterFunc);
    }
    
    server(server,auth_params,version){
        return new Connection_Node(this,server,auth_params,version);
    }
    
    brapi_call(behavior,httpMethod,url_body_func,multicall){
        return new BrAPI_Behavior_Node(
            this,this.connect,behavior,httpMethod,url_body_func,multicall
        );
    }
};

export class Filter_Node extends Context_Node{
    constructor(parent,connect,filterFunc){
        super([parent],connect,"filter");
        var self = this;
        parent.addAsyncHook(function(datum, key){
            if(filterFunc(datum)){
                var task = new Task(key);
                self.addTask(task);
                task.complete(datum);
                self.publishResult(task);
            } else if (self.getTasks().length == 0){
                self.checkFinished(true);
            }
        });
    }
};

export class Key_Node extends Context_Node{
    constructor(parent,connect,keyFunc){
        super([parent],connect,"key");
        var self = this;
        parent.addAsyncHook(function(datum, previous){
            var task = new Task(keyFunc(datum, previous));
            self.addTask(task);
            task.complete(datum);
            self.publishResult(task);
        });
    }
};

export class Map_Node extends Context_Node{
    constructor(parent,connect,mapFunc){
        super([parent],connect,"map");
        var self = this;
        parent.addAsyncHook(function(datum, key){
            var task = new Task(key);
            self.addTask(task);
            task.complete(mapFunc(datum,key));
            self.publishResult(task);
        });
    }
};

export class Reduce_Node extends Context_Node{
    constructor(parent,connect,reductionFunc,initialValue){
        super([parent],connect,"reduce");
        var task = new Task(0, "");
        this.addTask(task);
        var self = this;
        parent.addFinishHook(function(data, key){
            var out_datum = reductionFunc==undefined?data:data.reduce(reductionFunc,initialValue);
            task.complete(out_datum);
            self.publishResult(task);
        });
    }
};

export class Fork_Node extends Context_Node{
    constructor(parent,connect,forkFunc){
        super([parent],connect,"fork");
        var self = this;
        var forked_key = 0;
        parent.addAsyncHook(function(datum, key){
            var newData = forkFunc(datum);
            var newTasks = [];
            newData.forEach(function(newDatum){
                var task = new Task(forked_key, key);
                forked_key+=1;
                self.addTask(task);
                task.stored_result = newDatum;
                newTasks.push(task);
            });
            newTasks.forEach(function(task){
                task.complete(task.stored_result);
                self.publishResult(task);
            });
        });
    }
};

export class Join_Node extends Context_Node{
    constructor(parent_nodes,connect){
        super(parent_nodes,connect,"join");
        var key_origin = parent_nodes[0].getTaskKeyOrigin();
        var different_origins = parent_nodes.some(function(p){
            return p.getTaskKeyOrigin()!==key_origin
        });
        var all_user_keyed = parent_nodes.every(function(p){
            return p.getTaskKeyOrigin().node_type=="key";
        });
        if(different_origins && !all_user_keyed){
            throw "Cannot perform join due to contexts having different key origins!";
            return;
        }
        var self = this;
        parent_nodes.forEach(function(parent,parent_index){
            parent.addAsyncHook(function(datum, key){
                var task = self.getTask(key);
                if(task==undefined){
                    task = new Join_Task(key,parent_nodes.length)
                    self.addTask(task);
                }
                task.addResult(datum,parent_index)
                if (task.complete(true)){
                    self.publishResult(task);
                }
            });
            parent.addFinishHook(function(data){
                self.getTasks().forEach(function(task){
                    if (!task.complete()){
                        var pindex = parent_nodes.indexOf(parent);
                        if (task.result[pindex]===undefined) {
                            task.addResult(null,pindex)
                        }
                        if (task.complete(true)){
                            self.publishResult(task);
                        }
                    }
                });
            });
        });
    }
};

export class Connection_Node extends Context_Node{
    constructor(parent,server,auth_params,version){
        var base_url = server;
        if (base_url.slice(-1)=="/"){
            base_url=base_url.slice(0,-1);
        }
        super([parent],{'server':base_url, 'version':brapiVersion(version||1.2)},"map");
        var requrl = this.connect.server+"/token";
        var self = this;
        if (auth_params){
            fetchRef(requrl, {
                    method: 'post',
                    headers: {
                      'Content-Type': 'application/json;charset=utf-8'
                    },
                    body: JSON.stringify(auth_params)
                })
                .then(parse_json_response)
                .catch(function(reason){
                    self.fail(reason);
                    return null;
                })
                .then(function(json){
                    self.connect['auth']=json;
                    forward();
                });
        } else {
            this.connect['auth']=null;
            forward();
        }
        function forward(){
            parent.addAsyncHook(function(datum, key){
                var task = new Task(key);
                self.addTask(task);
                task.complete(datum);
                self.publishResult(task);
            });
        }
    }
}

export class Initial_Connection_Node extends Connection_Node{
    data(dataArray){
        return new Data_Node(this,this.connect,dataArray);
    }
}

export class Root_Node extends Context_Node{
    constructor(){
        super([],{},"fork");
        var task = new Task(0, "");
        this.addTask(task);
        task.complete(this.connect);
        this.publishResult(task);
    }
    server(server,auth_params,version){
        return new Initial_Connection_Node(this,server,auth_params,version);
    }
    data(dataArray){
        return new Data_Node(this,this.connect,dataArray);
    }
};

export class Data_Node extends Context_Node{
    constructor(parent,connect,dataArray){
        super([parent],connect,"fork");
        var self = this;
        dataArray.forEach(function(datum,i){
            var task = new Task(i, "");
            self.addTask(task);
            task.stored_result = datum;
        });
        parent.addFinishHook(function(){
            self.getTasks().forEach(function(task){
                task.complete(task.stored_result);
                self.publishResult(task);
            })
        });
    }
}

export class BrAPI_Behavior_Node extends Context_Node{
    constructor(parent,connect,behavior,httpMethod,url_body_func,multicall){
        super([parent],connect,behavior);
        this.behavior = behavior;
        this.d_func = url_body_func;
        this.method = httpMethod;
        var self = this;
        var hookTo = multicall ? parent.addAsyncHook : parent.addFinishHook;
        hookTo.call(parent,function(dat, key){
            var d_call = self.d_func(dat, key);
            if (self.connect.auth!=null && self.connect.auth.access_token){
                d_call.params['access_token'] = self.connect.auth.access_token
            }
            var pageRange = [0,Infinity];
            if (d_call.params.pageRange){
                pageRange = d_call.params.pageRange;
                delete d_call.params.pageRange;
            }
            var fetch_args = {
                method: d_call.params.HTTPMethod || self.method, 
                headers: {
                    'Content-Type': 'application/json;charset=utf-8'
                }
            };
            key = multicall ? key : 0;
            self.loadPage(pageRange[0],key,d_call,fetch_args,pageRange);
        });
    }
    
    formatURLParams(params){
        var start = true;
        var param_string = "";
        for (var param in params) {
            if (start) {
                param_string+="?"
                start = false
            } else {
                param_string+="&"
            }
            param_string+=param+"=";
            if (params[param] instanceof Array){
                param_string+=params[param].map(String).join("%2C")
            }
            else {
                param_string+=String(params[param]);
            }
        }
        return param_string
    }
    
    loadPage(page_num,unforked_key,d_call,fetch_args,pageRange,state){
        if (state==undefined){
            state = {
                'is_paginated': undefined,
                'concatenated': undefined,
                'sentry': undefined,
                'forked_key': 0
            }
        }
        var page_url = d_call.url;
        
        if(page_num>0) d_call.params["page"] = page_num;
        
        if (fetch_args.method=="put"||fetch_args.method=="post"){
            fetch_args["body"] = JSON.stringify(d_call.params)
        }
        else{
            page_url+=this.formatURLParams(d_call.params)
        }
        
        var sentry_task = state.sentry || new Task((page_num==pageRange[0]?"":"SENTRY"+page_num)+unforked_key);
        this.addTask(sentry_task);
        
        var self = this;
        fetchRef(this.connect.server+page_url,fetch_args)
            .then(parse_json_response)
            .catch(function(reason){
                self.fail(reason);
                return null;
            })
            .then(function(json){
                if(json==null){
                    sentry_task.complete(null);
                    self.publishResult(sentry_task);
                    return;
                }
                if(state.is_paginated==undefined){
                    if (json.result.data!=undefined && json.result.data instanceof Array){
                        state.is_paginated = true;
                    } else {
                        state.is_paginated = false;
                    }
                }
                if(json.metadata.asynchStatus && json.metadata.asynchStatus.status != "FINISHED"){
                    d_call.url = d_call.url.split(/\?(.+)/)[0];
                    d_call.url += "/"+json.metadata.asynchStatus.asynchId;
                    d_call.params = {};
                    fetch_args.method = "get";
                    delete fetch_args.body;
                    setTimeout(function(){
                        self.loadPage(page_num,unforked_key,d_call,fetch_args,pageRange,state);
                    },15000);
                    return
                }
                if(state.is_paginated){
                    var final_page = Math.min(+json.metadata.pagination.totalPages-1,pageRange[1]);
                    if(self.behavior=="fork"){
                        if (page_num<final_page){
                            self.loadPage(page_num+1,unforked_key,d_call,fetch_args,pageRange,state);
                        }
                        json.result.data.slice(0,-1).forEach(function(datum){
                            var task = new Task(state.forked_key, unforked_key);
                            state.forked_key+=1;
                            datum["__response"] = json;
                            self.addTask(task);
                            task.complete(datum);
                            self.publishResult(task);
                        });
                        sentry_task.setKey(state.forked_key, unforked_key);
                        state.forked_key+=1;
                        var sent_res = json.result.data[json.result.data.length-1];
                        sent_res["__response"] = json;
                        sentry_task.complete(sent_res);
                        self.publishResult(sentry_task);
                    }
                    else {
                        if(state.concatenated==undefined){
                            state.concatenated = json;
                            state.sentry = sentry_task;
                            state.concatenated.result["__response"] = state.concatenated;
                            delete state.concatenated.metadata.pagination;
                        } else {
                            [].push.apply(state.concatenated.result.data, json.result.data);
                        }
                        if (page_num<final_page){
                            self.loadPage(page_num+1,unforked_key,d_call,fetch_args,pageRange,state);
                        } else {
                            state.sentry.complete(state.concatenated.result);
                            self.publishResult(state.sentry);
                        }
                    }
                }
                else {
                    json.result["__response"] = json;
                    sentry_task.complete(json.result);
                    self.publishResult(sentry_task);
                }
            });
    };
};
