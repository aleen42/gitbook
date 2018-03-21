var path = require('path');
var fs = require('fs');

var Promise = require('../utils/promise');
var generatePage = require('./generatePage');
var fileToOutput = require('./helper/fileToOutput');

/**
    Output all pages using a generator

    @param {Generator} generator
    @param {Output} output
    @return {Promise<Output>}
*/
function generatePages(generator, output) {
    var pages = output.getPages();
    var logger = output.getLogger();

    // Is generator ignoring assets?
    if (!generator.onPage) {
        return Promise(output);
    }

    var count = 1;
    var completed = [];
    return Promise.reduce(pages, function(out, page) {
        var file = page.getFile();

        logger.debug.ln('generate page: "' + file.getPath() + '" (' + count++ + '/' + pages.size + ')');

        var filePath = file.getPath();
        var inputFilePath = path.join(out.getBook().getContentRoot(), filePath);
        var outputFilePath = path.join(out.getRoot(), filePath);

        if (fs.existsSync(outputFilePath)
            && fs.readFileSync(inputFilePath, { encoding: 'utf-8' }).replace(/\r|\n|\t/gi, '') === fs.readFileSync(outputFilePath, { encoding: 'utf-8' }).replace(/\r|\n|\t/gi, '')
            && fs.existsSync(path.join(out.getRoot(), fileToOutput(out, filePath)))
        ) {
            return Promise(out, page);
        }

        _checkParents(out, page);
        return _doGenerate(out, page, inputFilePath, outputFilePath);
    }, output);


    function _checkParents(out, page) {
        var summary = out.getBook().getSummary();
        var currentArticle = summary.getByPath(page.getPath());
        var parentArticle = summary.getParent(currentArticle);

        if (parentArticle.getPath) {
            if (!parentArticle.getPath()) {
                /** top-level as README.md */
                parentArticle = summary.getByPath('README.md');
            }

            var parentPage = out.getPage(parentArticle.getPath());
            var file = parentPage.getFile();

            logger.debug.ln('generate parent page: "' + file.getPath());

            var filePath = file.getPath();
            var inputFilePath = path.join(out.getBook().getContentRoot(), filePath);
            var outputFilePath = path.join(out.getRoot(), filePath);

            /** only generate when parent page is not generated before */
            !completed.includes(inputFilePath) && _doGenerate(out, parentPage, inputFilePath, outputFilePath);
            _checkParents(out, parentPage);
        }
    }

    function _doGenerate(out, page, inputFilePath, outputFilePath) {
        /** copy markdown file to the output directory */
        var folderPath = path.dirname(outputFilePath);
        var checkParentFolder = function (folder) {
            var parentFolder = path.resolve(folder, '..');
            if (!fs.existsSync(parentFolder)) {
                checkParentFolder(parentFolder);
                fs.mkdirSync(parentFolder);
            }
        };

        if (!fs.existsSync(folderPath)) {
            checkParentFolder(folderPath);
            fs.mkdirSync(folderPath);
        }

        fs.createReadStream(inputFilePath).pipe(fs.createWriteStream(outputFilePath));

        return generatePage(out, page)
            .then(function(resultPage) {
                /** mark page as completed */
                completed.push(inputFilePath);
                return generator.onPage(out, resultPage);
            })
            .fail(function(err) {
                logger.error.ln('error while generating page "' + page.getPath() + '":');
                throw err;
            });
    }
}

module.exports = generatePages;
