import { DeleteCommandInput, DeleteCommand } from '@aws-sdk/lib-dynamodb';

import type { DeleteCommandOutput } from '@aws-sdk/lib-dynamodb';
import type { EntityRecord } from '../entity';
import { unmarshallItem } from '../marshall';
import type { Table } from '../table';
import { Command, Result } from './base';
import { DbClient } from 'src/client';

export class DeleteItemCommand extends Command<DeleteCommandInput, DeleteCommandOutput, DeleteResult> {
	key: Record<string, string>;

	constructor(db: DbClient, table: Table, key: Record<string, string>) {
		super(db, table);
		this.key = key;
	}

	async send(): Promise<DeleteResult> {
		const output: DeleteCommandOutput = await this.db.send(new DeleteCommand(this.input()));
		return new DeleteResult(output, this.table);
	}

	input(): DeleteCommandInput {
		return {
			TableName: this.table.config().name,
			Key: this.key,
		}; // TODO: Merge with options
	}

	returnOld(): DeleteItemCommand {
		this.opts.ReturnValues = 'ALL_OLD';
		return this;
	}
	//TODO condition etc
}

export class DeleteResult extends Result<DeleteCommandOutput> {
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
