"use strict";

const EventEmitter = require('events');

class Namespace extends EventEmitter
{
	constructor(namespace,tm)
	{
		super();
		this.namespace = namespace;
		this.tm = tm;
    }

	cmd(name,data) 
	{
		return this.tm.cmd(name,data,this.namespace);
	}
	
	event(name,data) 
	{
		return this.tm.event(name,data,this.namespace);
	}
	
	close()
	{
		return this.tm.namespaces.delete(this.namespace);
	}
};


class TransactionManager extends EventEmitter 
{
    constructor(transport)
    {
        super()
        this.maxId = 0;
        this.transport = transport;
        this.transactions = new Map();
    }

    cmd(name, data, namespace) 
    {

        return new Promise((resolve,reject) => {
			//Check name is correct
			if (!name || name.length===0)
				throw new Error("Bad command name");

			//Create command
			const cmd = {
				type	: "cmd",
				transId	: this.maxId++,
				name	: name,
				data	: data
			};
			//Check namespace
			if (namespace)
				//Add it
				cmd.namespace = namespace;
			//Serialize
			cmd.resolve = resolve;
			cmd.reject  = reject;
			//Add to map
            this.transactions.set(cmd.transId,cmd);
            
			try {
				//Send json
				this.transport.emit('transaction', cmd);
			} catch (e) {
				//delete transacetion
				this.transactions.delete(cmd.transId);
				//rethrow
				throw e;
			}
		});
    }

	event(name,data,namespace) 
	{
		//Check name is correct
		if (!name || name.length===0)
			throw new Error("Bad event name");
		
		//Create command
		const event = {
			type	: "event",
			name	: name,
			data	: data
		};
		//Check namespace
		if (namespace)
			//Add it
            event.namespace = namespace;
            
		this.transport.emit('transaction', event);

    }

	namespace(ns)
	{
		//Check if we already have them
		let namespace = this.namespaces.get(ns);
		//If already have it
		if (namespace) return namespace;
		//Create one instead
		namespace = new Namespace(ns,this);
		//Store it
		this.namespaces.set(ns, namespace);
		//ok
		return namespace;
		
    }
    
	close()
	{
		//Erase namespaces
		for (const ns of this.namespace.values())
			//terminate it
            ns.close();
            
	}    
}


module.exports = TransactionManager;