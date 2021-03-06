"use strict";
/* This file was generated by https://github.com/dested/serverless-client-builder */
/* tslint:disable */
Object.defineProperty(exports, "__esModule", { value: true });
class ValidationError {
    constructor(model, reason, field) {
        this.model = model;
    }
}
exports.ValidationError = ValidationError;
class RequestValidator {
    static SomeRequest_SomeRequestAnswer_shoesValidator(model) {
        let fieldCount = 0;
        if (model === null)
            throw new ValidationError('SomeRequest_SomeRequestAnswer_shoes', 'missing', '');
        if (typeof model !== 'object')
            throw new ValidationError('SomeRequest_SomeRequestAnswer_shoes', 'mismatch', '');
        if ('foo' in model) {
            fieldCount++;
            if (typeof model.foo !== 'number')
                throw new ValidationError('SomeRequest_SomeRequestAnswer_shoes', 'mismatch', 'foo');
        }
        if (Object.keys(model).length !== fieldCount)
            throw new ValidationError('SomeRequest_SomeRequestAnswer_shoes', 'too-many-fields', '');
        return true;
    }
    static SomeRequest_SomeRequestAnswerValidator(model) {
        let fieldCount = 0;
        if (model === null)
            throw new ValidationError('SomeRequest_SomeRequestAnswer', 'missing', '');
        if (typeof model !== 'object')
            throw new ValidationError('SomeRequest_SomeRequestAnswer', 'mismatch', '');
        if (model.answerId === null)
            throw new ValidationError('SomeRequest_SomeRequestAnswer', 'missing', 'answerId');
        fieldCount++;
        if (typeof model.answerId !== 'string')
            throw new ValidationError('SomeRequest_SomeRequestAnswer', 'mismatch', 'answerId');
        if (model.decision === null)
            throw new ValidationError('SomeRequest_SomeRequestAnswer', 'missing', 'decision');
        fieldCount++;
        if (model.decision !== 'positive' && model.decision !== 'negative')
            throw new ValidationError('SomeRequest_SomeRequestAnswer', 'mismatch', 'decision');
        if (model.shoes === null)
            throw new ValidationError('SomeRequest_SomeRequestAnswer', 'missing', 'shoes');
        fieldCount++;
        this.SomeRequest_SomeRequestAnswer_shoesValidator(model.shoes);
        if (Object.keys(model).length !== fieldCount)
            throw new ValidationError('SomeRequest_SomeRequestAnswer', 'too-many-fields', '');
        return true;
    }
    static SomeRequestValidator(model) {
        let fieldCount = 0;
        if (model === null)
            throw new ValidationError('SomeRequest', 'missing', '');
        if (typeof model !== 'object')
            throw new ValidationError('SomeRequest', 'mismatch', '');
        if (model.id === null)
            throw new ValidationError('SomeRequest', 'missing', 'id');
        fieldCount++;
        if (typeof model.id !== 'string')
            throw new ValidationError('SomeRequest', 'mismatch', 'id');
        if (model.idn === null)
            throw new ValidationError('SomeRequest', 'missing', 'idn');
        fieldCount++;
        if (typeof model.idn !== 'number')
            throw new ValidationError('SomeRequest', 'mismatch', 'idn');
        if ('idnNull' in model) {
            fieldCount++;
            if (typeof model.idnNull !== 'number')
                throw new ValidationError('SomeRequest', 'mismatch', 'idnNull');
        }
        if (model.idb === null)
            throw new ValidationError('SomeRequest', 'missing', 'idb');
        fieldCount++;
        if (typeof model.idb !== 'boolean')
            throw new ValidationError('SomeRequest', 'mismatch', 'idb');
        if (model.idStArray === null)
            throw new ValidationError('SomeRequest', 'missing', 'idStArray');
        fieldCount++;
        if (typeof model.idStArray !== 'object' || !('length' in model.idStArray))
            throw new ValidationError('SomeRequest', 'mismatch', 'idStArray');
        for (let i = 0; i < model.idStArray.length; i++) {
            const idStArrayElem = model.idStArray[i];
            if (typeof idStArrayElem !== 'string')
                throw new ValidationError('SomeRequest', 'mismatch', 'idStArray');
        }
        if (model.answers === null)
            throw new ValidationError('SomeRequest', 'missing', 'answers');
        fieldCount++;
        if (typeof model.answers !== 'object' || !('length' in model.answers))
            throw new ValidationError('SomeRequest', 'mismatch', 'answers');
        for (let i = 0; i < model.answers.length; i++) {
            const answersElem = model.answers[i];
            this.SomeRequest_SomeRequestAnswerValidator(answersElem);
        }
        if (Object.keys(model).length !== fieldCount)
            throw new ValidationError('SomeRequest', 'too-many-fields', '');
        return true;
    }
}
exports.RequestValidator = RequestValidator;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicmVzdWx0LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vcmVzdWx0LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQSxvRkFBb0Y7QUFDcEYsb0JBQW9COztBQUVwQixNQUFhLGVBQWU7SUFDMUIsWUFBbUIsS0FBYSxFQUFFLE1BQWtELEVBQUUsS0FBYTtRQUFoRixVQUFLLEdBQUwsS0FBSyxDQUFRO0lBQXNFLENBQUM7Q0FDeEc7QUFGRCwwQ0FFQztBQUNELE1BQWEsZ0JBQWdCO0lBQzNCLE1BQU0sQ0FBQyw0Q0FBNEMsQ0FBQyxLQUFVO1FBQzVELElBQUksVUFBVSxHQUFHLENBQUMsQ0FBQztRQUNuQixJQUFJLEtBQUssS0FBSyxJQUFJO1lBQUUsTUFBTSxJQUFJLGVBQWUsQ0FBQyxxQ0FBcUMsRUFBRSxTQUFTLEVBQUUsRUFBRSxDQUFDLENBQUM7UUFDcEcsSUFBSSxPQUFPLEtBQUssS0FBSyxRQUFRO1lBQUUsTUFBTSxJQUFJLGVBQWUsQ0FBQyxxQ0FBcUMsRUFBRSxVQUFVLEVBQUUsRUFBRSxDQUFDLENBQUM7UUFFaEgsSUFBSSxLQUFLLElBQUksS0FBSyxFQUFFO1lBQ2xCLFVBQVUsRUFBRSxDQUFDO1lBQ2IsSUFBSSxPQUFPLEtBQUssQ0FBQyxHQUFHLEtBQUssUUFBUTtnQkFDL0IsTUFBTSxJQUFJLGVBQWUsQ0FBQyxxQ0FBcUMsRUFBRSxVQUFVLEVBQUUsS0FBSyxDQUFDLENBQUM7U0FDdkY7UUFFRCxJQUFJLE1BQU0sQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUMsTUFBTSxLQUFLLFVBQVU7WUFDMUMsTUFBTSxJQUFJLGVBQWUsQ0FBQyxxQ0FBcUMsRUFBRSxpQkFBaUIsRUFBRSxFQUFFLENBQUMsQ0FBQztRQUUxRixPQUFPLElBQUksQ0FBQztJQUNkLENBQUM7SUFFRCxNQUFNLENBQUMsc0NBQXNDLENBQUMsS0FBVTtRQUN0RCxJQUFJLFVBQVUsR0FBRyxDQUFDLENBQUM7UUFDbkIsSUFBSSxLQUFLLEtBQUssSUFB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