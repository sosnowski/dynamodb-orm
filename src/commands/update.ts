import { UpdateCommand, UpdateCommandInput } from '@aws-sdk/lib-dynamodb';

import type { UpdateCommandOutput } from '@aws-sdk/lib-dynamodb';
import type { EntityRecord } from '../entity';
import { marshallItem, unmarshallItem } from '../marshall';
import type { Table, UpdateData } from '../table';
import { Command, Result } from './base';
import { DbClient } from 'src/client';

const updateDataToInput = (
	updateData: UpdateData,
): Pick<UpdateCommandInput, 'UpdateExpression' | 'ExpressionAttributeNames' | 'ExpressionAttributeValues'> => {
	const updatedFields = Object.keys(updateData.set || {});
	const removedFields = updateData.remove || [];

	let updateExpression = '';
	let attributesNames: Record<string, string> = {};
	let attributesValues: Record<string, any> = {};

	if (updatedFields.length > 0) {
		updateExpression += ' SET ';
		updateExpression += updatedFields
			.map((field) => {
				return `#${field} = :${field}`;
			})
			.join(', ');
	}

	if (removedFields.length > 0) {
		updateExpression += ' REMOVE ';
		updateExpression += removedFields
			.map((field) => {
				return `#${field}`;
			})
			.join(', ');
	}

	Object.entries(updateData.set || {}).forEach(([field, value]) => {
		attributesNames[`#${field}`] = field;
		attributesValues[`:${field}`] = value;
	});
	removedFields.forEach((field) => {
		attributesNames[`#${field}`] = field;
	});

	return {
		UpdateExpression: updateExpression.trim(),
		ExpressionAttributeNames: attributesNames,
		ExpressionAttributeValues: marshallItem(attributesValues),
	};
};

export class UpdateItemCommand extends Command<UpdateCommandInput, UpdateCommand, UpdateCommandOutput, UpdateResult> {
	key: Record<string, string>;
	data: UpdateData;

	constructor(db: DbClient, table: Table, key: Record<string, string>, updateData: UpdateData) {
		super(db, table);
		this.key = key;
		this.data = updateData;
	}

	send(): Promise<UpdateResult> {
		return this.db.sendCommand(this);
	}

	result(output: UpdateCommandOutput): UpdateResult {
		return new UpdateResult(output, this.table);
	}
	command(): UpdateCommand {
		const updateInput = updateDataToInput(this.data);

		return new UpdateCommand({
			TableName: this.table.config().name,
			Key: this.key,
			ReturnValues: 'ALL_NEW',
			...updateInput,
		});
	}

	returnOld(): UpdateItemCommand {
		this.opts.ReturnValues = 'ALL_NEW';
		return this;
	}
}

export class UpdateResult extends Result<UpdateCommandOutput> {
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
