
function MyLib() {
    /* 取來源使用者ID*/
    this.GetSourceUserID = function(source) {
        if (source.hasOwnProperty('type')) {
            if (source.type == "user")
                return source.userId
            else if (source.type == "group")
                return source.groupId;
        } else
            return null;
    }

    /* 隨機英文字母*/
    this.RandomAlphabet = function() {
        const alphabets = 'abcdefghijklmnopqrstuvwxyz';
        let r_index = Math.floor((Math.random() * 26));
        return alphabets.charAt(r_index);
    }

    /* 隨機取陣列內項目*/
    this.RandomArrayItem = function(arr) {
        let arr_type = '';
        if (Array.isArray(arr))
            arr_type = 'a';
        else if (typeof arr === 'string')
            arr_type = 's';
        if (arr_type != '' && arr.length > 0) {
            let baseCount = arr.length > 10 ? arr.length : 10;
            let r_index = Math.floor((Math.random() * baseCount));
            while (r_index >= arr.length)
                r_index--;
            return arr_type == 'a' ? arr[r_index] : arr.charAt(r_index);
        }
        return null;
    }
}

var myLib = new MyLib();

module.exports = myLib;
