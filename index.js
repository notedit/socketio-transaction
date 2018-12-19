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
	broadcast(room, name, data, namespace) 
	{
		return this.tm.broadcast(room, name,data,this.namespace);
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
		this.namespaces = new Map();
		this.transactions = new Map();

		this.listener = (message) => {

			//Check type
			switch(message.type)
			{
				case "cmd" :
					//Create command
					const cmd = {
						name		: message.name,
						data		: message.data,
						namespace	: message.namespace,
						accept		: (data) => {
							//Send response back
							transport.emit('transaction', {
								type : 'response',
								transId : message.transId,
								data : data
							})

						},
						reject	: (data) => {
							//Send response back
							transport.emit('transaction', {
								type : 'error',
								transId : message.transId,
								data : data
							})
						}
					};
					
					//If it has a namespace
					if (cmd.namespace)
					{
						//Get namespace
						const namespace = this.namespaces.get(cmd.namespace);
						//If we have it
						if (namespace)
							//trigger event only on namespace
							namespace.emit("cmd",cmd);
						else
							//Launch event on main event handler
							this.emit("cmd",cmd);
					} else {
						//Launch event on main event handler
						this.emit("cmd",cmd);
					}
					break;
				case "response":
				{
					//Get transaction
					const transaction = this.transactions.get(message.transId);
					if (!transaction)
						return;
					//delete transacetion
					this.transactions.delete(message.transId);
					//Accept
					transaction.resolve(message.data);
					break;
				}
				case "error":
				{
					//Get transaction
					const transaction = this.transactions.get(message.transId);
					if (!transaction)
						return;
					//delete transacetion
					this.transactions.delete(message.transId);
					//Reject
					transaction.reject(message.data);
					break;
				}
				case "event":
					//Create event
					const event = {
						name		: message.name,
						data		: message.data,
						namespace	: message.namespace,
					};
					//If it has a namespace
					if (event.namespace)
					{
						//Get namespace
						var namespace = this.namespaces.get(event.namespace);
						//If we have it
						if (namespace)
							//trigger event
							namespace.emit("event",event);
						else
							//Launch event on main event handler
							this.emit("event",event);
					} else {
						//Launch event on main event handler
						this.emit("event",event);
					}
					break;
			}
		};

		this.transport.on('transaction', this.listener)
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

	broadcast(room, name, data, namespace) 
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
			
		this.transport.to(room).emit('transaction', event);
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