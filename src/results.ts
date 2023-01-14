import type {
	GetCommandOutput,
	QueryCommandOutput,
	PutCommandOutput,
	UpdateCommandOutput,
	DeleteCommandOutput,
} from '@aws-sdk/lib-dynamodb';
import type { DeleteItemCommand, GetItemCommand, PutItemCommand, QueryItemsCommand, UpdateItemCommand } from './commands';
import type { Entity, EntityRecord } from './entity';
import { unmarshallItem } from './marshall';
import type { Table } from './table';

export abstract class Result<Output, Command> {
	output: Output;
	table: Table;

	constructor(output: Output, table: Table) {
		this.output = output;
		this.table = table;
	}

	getOutput() {
		return this.output;
	}
}

export class GetResult extends Result<GetCommandOutput, GetItemCommand> {
	item<T extends object>(): (T & EntityRecord) | null {
		if (this.output.Item) {
			const entityType = this.output.Item._type;
			if (entityType && this.table.entity(entityType)) {
				const entity = this.table.entity<T>(entityType)!;
				return entity(unmarshallItem(this.output.Item) as T);
			} else {
				throw Error('Item does not have _type property or missing entity with such type :' + entityType);
			}
		}
		return null;
	}

	raw(): Record<string, any> | undefined {
		return this.output.Item;
	}
}

export class QueryResult extends Result<QueryCommandOutput, QueryItemsCommand> {
	items<T extends object>(): (T & EntityRecord)[] {
		if (this.output.Items) {
			return this.output.Items.map((item) => {
				if (item._type && this.table.entity(item._type)) {
					const entity = this.table.entity<T>(item._type)!;
					return entity(unmarshallItem(item) as T);
				} else {
					throw Error('Item does not have _type property or missing entity with such type :' + item._type);
				}
			});
		}
		return [];
	}

	raw(): Record<string, any>[] | undefined {
		return this.output.Items;
	}
}

export class PutResult extends Result<PutCommandOutput, PutItemCommand> {
	item<T extends object>(): (T & EntityRecord) | null {
		if (this.output.Attributes) {
			const entityType = this.output.Attributes._type;
			if (entityType && this.table.entity(entityType)) {
				const entity = this.table.entity<T>(entityType)!;
				return entity(unmarshallItem(this.output.Attributes) as T);
			} else {
				throw Error('Item does not have _type property or missing entity with such type :' + entityType);
			}
		}
		return null;
	}

	raw(): Record<string, any> | undefined {
		return this.output.Attributes;
	}
}

export class UpdateResult extends Result<UpdateCommandOutput, UpdateItemCommand> {
	item<T extends object>(): (T & EntityRecord) | null {
		if (this.output.Attributes) {
			const entityType = this.output.Attributes._type;
			if (entityType && this.table.entity(entityType)) {
				const entity = this.table.entity<T>(entityType)!;
				return entity(unmarshallItem(this.output.Attributes) as T);
			} else {
				throw Error('Item does not have _type property or missing entity with such type :' + entityType);
			}
		}
		return null;
	}

	raw(): Record<string, any> | undefined {
		return this.output.Attributes;
	}
}

export class DeleteResult extends Result<DeleteCommandOutput, DeleteItemCommand> {
	item<T extends object>(): (T & EntityRecord) | null {
		if (this.output.Attributes) {
			const entityType = this.output.Attributes._type;
			if (entityType && this.table.entity(entityType)) {
				const entity = this.table.entity<T>(entityType)!;
				return entity(unmarshallItem(this.output.Attributes) as T);
			} else {
				throw Error('Item does not have _type property or missing entity with such type :' + entityType);
			}
		}
		return null;
	}

	raw(): Record<string, any> | undefined {
		return this.output.Attributes;
	}
}
