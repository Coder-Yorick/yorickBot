function LineItem() {
    this.Template = function(altText, title) {
        this.type = 'template';
        this.altText = altText;
        this.template = {
            type: 'buttons',
            text: title,
            actions: []
        }
    }

    this.TemplateAction = function(label, data) {
        this.type = 'postback';
        this.label = label;
        this.data = data;
    }
}

var lineItem = new LineItem();

module.exports = lineItem;