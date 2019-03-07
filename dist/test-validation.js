"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const result_1 = require("./result");
const someRequest = {
    id: 'foo',
    idb: true,
    answers: [
        { answerId: 'asdfb', decision: 'positive', shoes: { foo: 123 } },
        { answerId: 'asdfb', decision: 'positive', shoes: { foo: 123 } },
    ],
    idn: 12,
    idStArray: ['a', 'b', 'c'],
};
result_1.RequestValidator.SomeRequestValidator(someRequest);
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGVzdC12YWxpZGF0aW9uLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vdGVzdC12YWxpZGF0aW9uLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7O0FBQUEscUNBQTBDO0FBZ0IxQyxNQUFNLFdBQVcsR0FBRztJQUNsQixFQUFFLEVBQUUsS0FBSztJQUNULEdBQUcsRUFBRSxJQUFJO0lBQ1QsT0FBTyxFQUFFO1FBQ1AsRUFBQyxRQUFRLEVBQUUsT0FBTyxFQUFFLFFBQVEsRUFBRSxVQUFVLEVBQUUsS0FBSyxFQUFFLEVBQUMsR0FBRyxFQUFFLEdBQUcsRUFBQyxFQUFDO1FBQzVELEVBQUMsUUFBUSxFQUFFLE9BQU8sRUFBRSxRQUFRLEVBQUUsVUFBVSxFQUFFLEtBQUssRUFBRSxFQUFDLEdBQUcsRUFBRSxHQUFHLEVBQUMsRUFBQztLQUM3RDtJQUNELEdBQUcsRUFBRSxFQUFFO0lBQ1AsU0FBUyxFQUFFLENBQUMsR0FBRyxFQUFFLEdBQUcsRUFBRSxHQUFHLENBQUM7Q0FDM0IsQ0FBQztBQUVGLHlCQUFnQixDQUFDLG9CQUFvQixDQUFDLFdBQVcsQ0FBQyxDQUFDIn0=