function drawFaceExpressions(canvasArg, faceExpressions, minConfidence = 0.6, textFieldAnchor, name = 'Samsul') {
    var faceExpressionsArray = Array.isArray(faceExpressions) ? faceExpressions : [faceExpressions];
    faceExpressionsArray.forEach(function (e) {
        var expr = e instanceof FaceExpressions
            ? e
            : (isWithFaceExpressions(e) ? e.expressions : undefined);
        if (!expr) {
            throw new Error('drawFaceExpressions - expected faceExpressions to be FaceExpressions | WithFaceExpressions<{}> or array thereof');
        }

        // Filter expressions based on minConfidence
        var sorted = expr.asSortedArray();
        var resultsToDisplay = sorted.filter(function (expr) { return expr.probability > minConfidence; });

        // Determine anchor positions
        var box = isWithFaceDetection(e) ? e.detection.box : null;
        var textAnchor = box ? box.bottomLeft : (textFieldAnchor || new Point(0, 0));
        var nameAnchor = box ? box.topLeft : new Point(0, 0); // Nama di atas box

        // Draw name above the box
        if (name) {
            var drawNameField = new DrawTextField([name], nameAnchor);
            drawNameField.draw(canvasArg);
        }

        // Draw expressions below the box
        var drawTextField = new DrawTextField(
            resultsToDisplay.map(function (expr) { return expr.expression; }),
            textAnchor
        );
        drawTextField.draw(canvasArg);
    });
}